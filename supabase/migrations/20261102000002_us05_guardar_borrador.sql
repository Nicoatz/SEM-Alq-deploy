-- US-05 · Guardar el borrador del contrato por pasos (partes, garantes, condiciones y cláusulas)
--
-- Requiere 20261102000000 (modelo de dos contratos) y 20261102000001 (iniciar_contrato).
-- Todo se guarda en una transacción; el borrador se puede guardar incompleto (los datos
-- obligatorios se exigen recién al enviar a firmar, Paso 6).

-- ─── 1. Cláusulas: clave estable ───
-- La clave identifica cada cláusula de la plantilla ("objeto", "plazo", "propia-1"...). Con ella
-- se reconoce una cláusula fija ya guardada para no dejar que se modifique.
ALTER TABLE public.clausula_contrato
  ADD COLUMN IF NOT EXISTS clave VARCHAR(50) NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_clausula_contrato_clave
  ON public.clausula_contrato (id_contrato, clave);

-- ─── 2. Fecha de fin ───
-- Regla del PO (US-05, paso 2): fin = inicio + N meses − 1 día. Si el día de inicio no existe en
-- el mes de destino (31/01 + 1 mes), el contrato termina el último día de ese mes, sin restar.
CREATE OR REPLACE FUNCTION public.calcular_fecha_fin_contrato(
    p_inicio DATE,
    p_meses INTEGER
)
RETURNS DATE
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_destino DATE;
BEGIN
    IF p_inicio IS NULL OR p_meses IS NULL OR p_meses <= 0 THEN
        RETURN NULL;
    END IF;

    v_destino := (p_inicio + make_interval(months => p_meses))::DATE;

    -- Postgres "achicó" el día (31 → 28): ese ya es el último día del período.
    IF EXTRACT(DAY FROM v_destino) <> EXTRACT(DAY FROM p_inicio) THEN
        RETURN v_destino;
    END IF;

    RETURN v_destino - 1;
END;
$$;

-- Casos verificados por el front (apps/web/src/lib/contratos/fechas.ts). Si alguno falla, la
-- migración se corta.
DO $$
BEGIN
    IF public.calcular_fecha_fin_contrato(DATE '2026-10-01', 36) <> DATE '2029-09-30'
       OR public.calcular_fecha_fin_contrato(DATE '2026-04-01', 36) <> DATE '2029-03-31'
       OR public.calcular_fecha_fin_contrato(DATE '2027-01-31', 1) <> DATE '2027-02-28'
       OR public.calcular_fecha_fin_contrato(DATE '2027-01-28', 1) <> DATE '2027-02-27'
       OR public.calcular_fecha_fin_contrato(DATE '2028-02-29', 12) <> DATE '2029-02-28'
       OR public.calcular_fecha_fin_contrato(NULL, 12) IS NOT NULL
       OR public.calcular_fecha_fin_contrato(DATE '2026-10-01', 0) IS NOT NULL
    THEN
        RAISE EXCEPTION 'calcular_fecha_fin_contrato no cumple los casos de la US-05.';
    END IF;
END;
$$;

-- ─── 3. Guardar el borrador ───
-- p_data (todas las claves son opcionales; solo se toca lo que viene):
--   paso:        1 a 4, último paso del alta.
--   condiciones: fecha_inicio_contrato, duracion_meses, monto_alquiler, deposito,
--                dias_para_vencimiento, indice_aumento, frecuencia_ajuste.
--   garantes:    lista completa [{ nombre, apellido, dni, email }]; reemplaza la anterior.
--   clausulas:   lista completa [{ clave, tipo, titulo, texto, editada }]; reemplaza la anterior.
-- El formato de cada dato lo valida la API antes de llamar; acá van las reglas que necesitan
-- la base: dueño y estado del contrato, garantes distintos de las partes y cláusulas fijas.
-- Devuelve JSONB { success, statusCode, message }, como iniciar_contrato.
CREATE OR REPLACE FUNCTION public.guardar_borrador_contrato(
    p_id_contrato INTEGER,
    p_id_locador INTEGER,
    p_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_contrato public.contrato%ROWTYPE;
    v_cond JSONB := COALESCE(p_data->'condiciones', '{}'::JSONB);
BEGIN
    -- Bloquear el contrato; la oferta (estado 1) nunca se edita por acá.
    SELECT c.*
    INTO v_contrato
    FROM public.contrato c
    JOIN public.inmueble i ON i.id = c.id_inmueble
    WHERE c.id = p_id_contrato
      AND c.estado <> 1
      AND c.activo = TRUE
      AND i.id_locador = p_id_locador
    FOR UPDATE OF c;

    -- Un contrato ajeno se informa como inexistente, para no revelar que existe.
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'statusCode', 404,
            'message', 'No encontramos este contrato.'
        );
    END IF;

    -- US-05: un contrato enviado a firmar no se puede editar.
    IF v_contrato.estado <> 5 THEN
        RETURN jsonb_build_object(
            'success', false,
            'statusCode', 409,
            'message', 'Solo se puede modificar un contrato en borrador.'
        );
    END IF;

    -- US-05, paso 1: no se puede cargar como garante al locador ni al locatario.
    IF p_data ? 'garantes' AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p_data->'garantes') AS g(value)
        JOIN public.contrato_x_usuario cxu
          ON cxu.id_contrato = p_id_contrato AND cxu.tipo_firmante IN (1, 2)
        JOIN public.usuario u ON u.id = cxu.id_usuario
        WHERE btrim(g.value->>'dni') = u.numero_documento
           OR lower(btrim(g.value->>'email')) = lower(u.email)
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'statusCode', 400,
            'message', 'No se puede cargar como garante al locador ni al locatario del contrato.'
        );
    END IF;

    -- US-05, paso 3: las cláusulas fijas ya guardadas no se pueden modificar ni quitar.
    IF p_data ? 'clausulas' AND EXISTS (
        SELECT 1
        FROM public.clausula_contrato e
        WHERE e.id_contrato = p_id_contrato
          AND e.tipo = 'fija'
          AND NOT EXISTS (
              SELECT 1
              FROM jsonb_array_elements(p_data->'clausulas') AS c(value)
              WHERE c.value->>'clave' = e.clave
                AND c.value->>'tipo' = 'fija'
                AND c.value->>'titulo' = e.titulo
                AND c.value->>'texto' = e.texto
          )
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'statusCode', 400,
            'message', 'Las cláusulas fijas no se pueden modificar ni quitar.'
        );
    END IF;

    -- Si algo de lo que sigue falla, se deshace todo lo del bloque.
    BEGIN
        UPDATE public.contrato
        SET fecha_inicio_contrato = CASE
                WHEN v_cond ? 'fecha_inicio_contrato'
                THEN NULLIF(v_cond->>'fecha_inicio_contrato', '')::DATE
                ELSE fecha_inicio_contrato
            END,
            duracion_meses = CASE
                WHEN v_cond ? 'duracion_meses'
                THEN NULLIF(v_cond->>'duracion_meses', '')::INTEGER
                ELSE duracion_meses
            END,
            monto_alquiler = CASE
                WHEN v_cond ? 'monto_alquiler'
                THEN (v_cond->>'monto_alquiler')::NUMERIC
                ELSE monto_alquiler
            END,
            deposito = CASE
                WHEN v_cond ? 'deposito'
                THEN NULLIF(v_cond->>'deposito', '')::NUMERIC
                ELSE deposito
            END,
            dias_para_vencimiento = CASE
                WHEN v_cond ? 'dias_para_vencimiento'
                THEN NULLIF(v_cond->>'dias_para_vencimiento', '')::SMALLINT
                ELSE dias_para_vencimiento
            END,
            indice_aumento = CASE
                WHEN v_cond ? 'indice_aumento'
                THEN NULLIF(v_cond->>'indice_aumento', '')::INTEGER
                ELSE indice_aumento
            END,
            frecuencia_ajuste = CASE
                WHEN v_cond ? 'frecuencia_ajuste'
                THEN NULLIF(v_cond->>'frecuencia_ajuste', '')
                ELSE frecuencia_ajuste
            END,
            ultimo_paso_borrador = CASE
                WHEN p_data ? 'paso'
                THEN (p_data->>'paso')::SMALLINT
                ELSE ultimo_paso_borrador
            END
        WHERE id = p_id_contrato;

        -- US-05, paso 2: sin índice (o "Sin ajuste") no hay periodicidad; la fecha de fin se
        -- calcula siempre a partir del inicio y la duración que quedaron guardados.
        UPDATE public.contrato
        SET frecuencia_ajuste = CASE
                WHEN indice_aumento IS NULL THEN NULL
                ELSE frecuencia_ajuste
            END,
            fecha_fin_contrato = public.calcular_fecha_fin_contrato(
                fecha_inicio_contrato,
                duracion_meses
            )
        WHERE id = p_id_contrato;

        IF p_data ? 'garantes' THEN
            DELETE FROM public.garante WHERE id_contrato = p_id_contrato;

            INSERT INTO public.garante (id_contrato, nombre, apellido, dni, email)
            SELECT p_id_contrato,
                   btrim(g.value->>'nombre'),
                   btrim(g.value->>'apellido'),
                   btrim(g.value->>'dni'),
                   lower(btrim(g.value->>'email'))
            FROM jsonb_array_elements(p_data->'garantes') AS g(value);
        END IF;

        IF p_data ? 'clausulas' THEN
            DELETE FROM public.clausula_contrato WHERE id_contrato = p_id_contrato;

            INSERT INTO public.clausula_contrato (
                id_contrato, orden, clave, tipo, titulo, texto, editada
            )
            SELECT p_id_contrato,
                   c.orden::SMALLINT,
                   c.value->>'clave',
                   c.value->>'tipo',
                   c.value->>'titulo',
                   c.value->>'texto',
                   COALESCE((c.value->>'editada')::BOOLEAN, FALSE)
            FROM jsonb_array_elements(p_data->'clausulas') WITH ORDINALITY AS c(value, orden);
        END IF;
    EXCEPTION
        WHEN unique_violation THEN
            RETURN jsonb_build_object(
                'success', false,
                'statusCode', 400,
                'message', 'No se pueden repetir el DNI ni el correo entre garantes, ni la clave entre cláusulas.'
            );
        WHEN foreign_key_violation THEN
            RETURN jsonb_build_object(
                'success', false,
                'statusCode', 400,
                'message', 'El índice de ajuste indicado no existe.'
            );
        WHEN check_violation THEN
            RETURN jsonb_build_object(
                'success', false,
                'statusCode', 400,
                'message', 'Algún dato no cumple las reglas del contrato.'
            );
    END;

    RETURN jsonb_build_object(
        'success', true,
        'statusCode', 200,
        'message', 'Borrador guardado correctamente.'
    );
END;
$$;

-- Solo la API (clave de servicio) puede llamarla: no queda expuesta a anon ni a authenticated.
GRANT EXECUTE ON FUNCTION public.guardar_borrador_contrato(INTEGER, INTEGER, JSONB) TO service_role;
REVOKE EXECUTE ON FUNCTION public.guardar_borrador_contrato(INTEGER, INTEGER, JSONB)
    FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
