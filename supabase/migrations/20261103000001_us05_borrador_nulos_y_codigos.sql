-- US-05 · Ajustes al registro del contrato
--
-- 1. El borrador acepta nulos en duración, monto y plazo de vencimiento: se puede guardar
--    incompleto (US-05) y lo obligatorio se exige recién al enviar a firmar.
-- 2. `dias_para_vencimiento` es un PLAZO EN DÍAS, como lo usa US-27 (`/alquileres-locatario`): los
--    días que tiene el locatario para pagar desde que el monto queda disponible. Antes el registro
--    lo trataba como "día del mes"; se alinea con US-27.
-- 3. Las funciones que escriben devuelven un `codigo` en cada 409, para que el cliente distinga los
--    casos sin leer el texto del mensaje.

-- ─── 1. Monto nulo en el borrador ───
-- duracion_meses y dias_para_vencimiento ya admitían nulos. monto_alquiler era NOT NULL porque la
-- oferta (estado 1) y los contratos enviados siempre lo tienen: se mantiene esa regla para todo lo
-- que no sea un borrador (estado 5).
ALTER TABLE public.contrato
  ALTER COLUMN monto_alquiler DROP NOT NULL;

ALTER TABLE public.contrato
  DROP CONSTRAINT IF EXISTS contrato_monto_obligatorio_check,
  ADD CONSTRAINT contrato_monto_obligatorio_check
    CHECK (estado = 5 OR monto_alquiler IS NOT NULL);

-- ─── 2. Qué significa dias_para_vencimiento ───
COMMENT ON COLUMN public.contrato.dias_para_vencimiento IS
  'Plazo de pago en días (1 a 28): los días que tiene el locatario para pagar desde que el monto queda disponible. Lo usa US-27 para calcular el próximo vencimiento. No es el día del mes.';

-- ─── 3. iniciar_contrato, con codigo en los 409 ───
-- Misma función de 20261102000001; solo se suma `codigo` a las respuestas 409:
--   SOLICITUD_NO_ACEPTADA, SOLICITUD_CON_CONTRATO, PROPIEDAD_CON_BORRADOR, PROPIEDAD_CON_CONTRATO,
--   PROPIEDAD_SIN_OFERTA y CONTRATO_DUPLICADO.
CREATE OR REPLACE FUNCTION public.iniciar_contrato(
    p_id_solicitud INTEGER,
    p_id_locador INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_solicitud public.solicitud%ROWTYPE;
    v_inmueble public.inmueble%ROWTYPE;
    v_oferta public.contrato%ROWTYPE;
    v_en_curso public.contrato%ROWTYPE;
    v_contrato_id INTEGER;
BEGIN
    -- Bloquear la solicitud: dos clics seguidos no pueden crear dos contratos.
    SELECT *
    INTO v_solicitud
    FROM public.solicitud
    WHERE id = p_id_solicitud
    FOR UPDATE;

    -- Una solicitud ajena se informa como inexistente, para no revelar que existe.
    IF NOT FOUND OR v_solicitud.id_locador <> p_id_locador THEN
        RETURN jsonb_build_object(
            'success', false,
            'statusCode', 404,
            'message', 'La solicitud no existe o no pertenece al locador.'
        );
    END IF;

    -- US-05: el contrato se inicia solo desde una solicitud aceptada (estado 2).
    IF v_solicitud.id_estado_solicitud <> 2 THEN
        RETURN jsonb_build_object(
            'success', false,
            'statusCode', 409,
            'codigo', 'SOLICITUD_NO_ACEPTADA',
            'message', 'Solo se puede iniciar un contrato desde una solicitud aceptada.'
        );
    END IF;

    -- US-05: una solicitud aceptada puede originar un solo contrato.
    IF EXISTS (
        SELECT 1 FROM public.contrato WHERE id_solicitud = p_id_solicitud
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'statusCode', 409,
            'codigo', 'SOLICITUD_CON_CONTRATO',
            'message', 'Esta solicitud ya originó un contrato.'
        );
    END IF;

    SELECT *
    INTO v_inmueble
    FROM public.inmueble
    WHERE id = v_solicitud.id_inmueble
    FOR UPDATE;

    IF NOT FOUND OR NOT v_inmueble.activo THEN
        RETURN jsonb_build_object(
            'success', false,
            'statusCode', 404,
            'message', 'La propiedad no existe.'
        );
    END IF;

    -- US-05: la propiedad no debe tener un contrato vigente ni pendiente de firma. Un borrador
    -- tampoco: solo hay un contrato en curso por propiedad.
    SELECT *
    INTO v_en_curso
    FROM public.contrato
    WHERE id_inmueble = v_inmueble.id
      AND estado IN (2, 4, 5)
      AND activo = TRUE
    LIMIT 1;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'statusCode', 409,
            'codigo', CASE v_en_curso.estado
                WHEN 5 THEN 'PROPIEDAD_CON_BORRADOR'
                ELSE 'PROPIEDAD_CON_CONTRATO'
            END,
            'message', CASE v_en_curso.estado
                WHEN 5 THEN 'La propiedad ya tiene un contrato en borrador.'
                ELSE 'La propiedad ya tiene un contrato vigente o pendiente de firma.'
            END
        );
    END IF;

    -- Las condiciones de partida salen de la oferta (lo que está publicado).
    SELECT *
    INTO v_oferta
    FROM public.contrato
    WHERE id_inmueble = v_inmueble.id
      AND estado = 1
      AND activo = TRUE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'statusCode', 409,
            'codigo', 'PROPIEDAD_SIN_OFERTA',
            'message', 'La propiedad no tiene condiciones de oferta cargadas.'
        );
    END IF;

    BEGIN
        INSERT INTO public.contrato (
            id_inmueble,
            monto_alquiler,
            expensas,
            indice_aumento,
            frecuencia_ajuste,
            duracion_meses,
            deposito,
            interes_por_dia,
            dias_gracia,
            dias_para_vencimiento,
            estado,
            id_solicitud,
            ultimo_paso_borrador
        )
        VALUES (
            v_inmueble.id,
            -- US-05, paso 2: el monto inicial precarga el precio publicado.
            v_oferta.monto_alquiler,
            v_oferta.expensas,
            v_oferta.indice_aumento,
            -- US-05, paso 2: la periodicidad es trimestral, semestral o anual. La publicación
            -- guarda texto libre ("Semestral", "Cuatrimestral"): se normaliza o queda vacía
            -- para que el locador la elija.
            CASE
                WHEN lower(v_oferta.frecuencia_ajuste) IN ('trimestral', 'semestral', 'anual')
                THEN lower(v_oferta.frecuencia_ajuste)
                ELSE NULL
            END,
            -- US-05, paso 2: la duración por defecto es de 24 meses.
            24,
            -- US-05, paso 2: el depósito por defecto equivale a un mes de alquiler.
            v_oferta.monto_alquiler,
            v_oferta.interes_por_dia,
            v_oferta.dias_gracia,
            -- US-05, paso 2: el plazo de vencimiento del pago por defecto es de 10 días.
            10,
            5,
            p_id_solicitud,
            1
        )
        RETURNING id INTO v_contrato_id;
    EXCEPTION WHEN unique_violation THEN
        -- Otro pedido ganó la carrera (la misma solicitud o la misma propiedad).
        RETURN jsonb_build_object(
            'success', false,
            'statusCode', 409,
            'codigo', 'CONTRATO_DUPLICADO',
            'message', 'Ya existe un contrato para esta solicitud o propiedad.'
        );
    END;

    -- US-05, paso 2: los medios de pago de la propiedad se muestran en solo lectura.
    INSERT INTO public.medio_pago_x_contrato (id_contrato, id_medio_pago)
    SELECT v_contrato_id, id_medio_pago
    FROM public.medio_pago_x_contrato
    WHERE id_contrato = v_oferta.id;

    -- US-05, paso 1: el locador y el locatario vienen precargados (tipo 1 y tipo 2).
    INSERT INTO public.contrato_x_usuario (id_contrato, id_usuario, tipo_firmante)
    VALUES
        (v_contrato_id, v_solicitud.id_locador, 1),
        (v_contrato_id, v_solicitud.id_locatario, 2);

    RETURN jsonb_build_object(
        'success', true,
        'statusCode', 201,
        'message', 'Contrato iniciado correctamente.',
        'contrato_id', v_contrato_id
    );
END;
$$;

-- ─── 4. guardar_borrador_contrato: nulos y codigo ───
-- Misma función de 20261103000000, con dos cambios:
--   · monto_alquiler acepta vacío (el borrador puede estar incompleto), como ya hacían la duración
--     y el plazo de vencimiento;
--   · el 409 lleva `codigo` CONTRATO_NO_EDITABLE.
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
            'codigo', 'CONTRATO_NO_EDITABLE',
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
                THEN NULLIF(v_cond->>'monto_alquiler', '')::NUMERIC
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
        -- calcula siempre a partir del inicio y la duración que quedaron guardados (vacía si
        -- falta alguno de los dos).
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
    EXCEPTION
        WHEN unique_violation THEN
            RETURN jsonb_build_object(
                'success', false,
                'statusCode', 400,
                'message', 'No se pueden repetir el DNI ni el correo entre garantes.'
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

-- ─── 5. registrar_pdf_contrato: codigo en el 409 ───
-- Misma función de 20261103000000; el 409 lleva `codigo` CONTRATO_NO_EDITABLE.
CREATE OR REPLACE FUNCTION public.registrar_pdf_contrato(
    p_id_contrato INTEGER,
    p_id_locador INTEGER,
    p_path TEXT,
    p_sha256 TEXT,
    p_nombre TEXT,
    p_tamano INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_contrato public.contrato%ROWTYPE;
BEGIN
    SELECT c.*
    INTO v_contrato
    FROM public.contrato c
    JOIN public.inmueble i ON i.id = c.id_inmueble
    WHERE c.id = p_id_contrato
      AND c.estado <> 1
      AND c.activo = TRUE
      AND i.id_locador = p_id_locador
    FOR UPDATE OF c;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'statusCode', 404,
            'message', 'No encontramos este contrato.'
        );
    END IF;

    -- US-05: un contrato enviado a firmar no se puede editar, tampoco su PDF.
    IF v_contrato.estado <> 5 THEN
        RETURN jsonb_build_object(
            'success', false,
            'statusCode', 409,
            'codigo', 'CONTRATO_NO_EDITABLE',
            'message', 'Solo se puede modificar un contrato en borrador.'
        );
    END IF;

    UPDATE public.contrato
    SET pdf_storage_path = p_path,
        pdf_sha256 = p_sha256,
        pdf_nombre_original = p_nombre,
        pdf_tamano_bytes = p_tamano,
        pdf_subido_en = now()
    WHERE id = p_id_contrato;

    RETURN jsonb_build_object(
        'success', true,
        'statusCode', 200,
        'message', 'PDF registrado correctamente.',
        'pdf_anterior', v_contrato.pdf_storage_path
    );
EXCEPTION
    WHEN check_violation THEN
        RETURN jsonb_build_object(
            'success', false,
            'statusCode', 400,
            'message', 'El PDF no cumple las reglas del contrato.'
        );
END;
$$;

NOTIFY pgrst, 'reload schema';
