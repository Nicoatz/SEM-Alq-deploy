-- US-05 · El paso 3 pasa de "Cláusulas" a "Carga": el contrato se sube como PDF (hasta 5 MB)
--
-- Cambios respecto de 20261102000000 y 20261102000002:
--   · se elimina `clausula_contrato` (ya no hay cláusulas en el alta);
--   · `contrato` guarda los datos del PDF subido (la ruta y el hash ya existían desde US-27);
--   · `guardar_borrador_contrato` deja de manejar cláusulas;
--   · `registrar_pdf_contrato` registra el PDF en el borrador;
--   · el bucket `contratos-pdf` (privado, de US-27) limita tamaño y tipo, porque el navegador
--     sube el archivo directo a Storage.
--
-- Por qué la subida va directo a Storage: la API se despliega en Vercel, cuyas funciones aceptan
-- cuerpos de hasta 4,5 MB, y la US permite PDFs de hasta 5 MB. La API entrega una URL de subida
-- firmada y después valida el archivo ya subido (tipo, tamaño, hash) antes de registrarlo.

-- ─── 1. Se eliminan las cláusulas ───
DROP TABLE IF EXISTS public.clausula_contrato;

-- ─── 2. Datos del PDF en el contrato ───
-- pdf_storage_path y pdf_sha256 ya existen (US-27): el locatario recibe una URL firmada de ese
-- mismo archivo. Se suman los datos que necesita la pantalla de carga.
ALTER TABLE public.contrato
  ADD COLUMN IF NOT EXISTS pdf_nombre_original VARCHAR(255),
  ADD COLUMN IF NOT EXISTS pdf_tamano_bytes INTEGER,
  ADD COLUMN IF NOT EXISTS pdf_subido_en TIMESTAMPTZ;

-- US-05, paso 3: tamaño no superior a 5 MB (5 * 1024 * 1024 bytes).
ALTER TABLE public.contrato
  DROP CONSTRAINT IF EXISTS contrato_pdf_tamano_check,
  ADD CONSTRAINT contrato_pdf_tamano_check
    CHECK (pdf_tamano_bytes IS NULL OR pdf_tamano_bytes BETWEEN 1 AND 5242880);

-- ─── 3. Bucket: solo PDF y hasta 5 MB ───
-- El navegador sube directo a Storage con una URL firmada; el límite se aplica acá además de
-- en la API.
UPDATE storage.buckets
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY['application/pdf']
WHERE id = 'contratos-pdf';

-- ─── 4. Guardar el borrador (sin cláusulas) ───
-- Misma función de 20261102000002 sin la parte de cláusulas. p_data (claves opcionales):
--   paso:        1 a 4, último paso del alta.
--   condiciones: fecha_inicio_contrato, duracion_meses, monto_alquiler, deposito,
--                dias_para_vencimiento, indice_aumento, frecuencia_ajuste.
--   garantes:    lista completa [{ nombre, apellido, dni, email }]; reemplaza la anterior.
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

-- ─── 5. Registrar el PDF en el borrador ───
-- La API ya subió el archivo a Storage y validó que sea un PDF de hasta 5 MB. Acá se registra en
-- el contrato, que solo puede estar en borrador. Devuelve la ruta del PDF anterior (si había
-- uno) para que la API lo borre de Storage.
-- Devuelve JSONB { success, statusCode, message, pdf_anterior? }.
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

-- Solo la API (clave de servicio) puede llamarla: no queda expuesta a anon ni a authenticated.
GRANT EXECUTE ON FUNCTION public.registrar_pdf_contrato(INTEGER, INTEGER, TEXT, TEXT, TEXT, INTEGER)
    TO service_role;
REVOKE EXECUTE ON FUNCTION public.registrar_pdf_contrato(INTEGER, INTEGER, TEXT, TEXT, TEXT, INTEGER)
    FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
