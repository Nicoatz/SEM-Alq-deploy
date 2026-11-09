-- US-07 · Firma electrónica con DocuSign (esquema)
--
-- Modelo: cada contrato pendiente de firma tiene UN sobre (envelope) de DocuSign con un
-- destinatario por parte: locador, locatario y garantes. La firma es "embebida": el usuario
-- firma dentro de una URL de DocuSign que genera la API en el momento (no hay mails).
--   · Locador y locatario: tienen sesión en RentAR; la API les pide la URL de firma.
--   · Garantes: no son usuarios. Firman con un enlace temporal propio de RentAR (token en
--     `garante.token_firma_hash`, que ya existe desde US-05); al abrirlo, la API le pide a
--     DocuSign la URL de firma de ese garante.
-- La fuente de verdad del estado de cada firma es el webhook (DocuSign Connect), no el
-- navegador: ver `docusign_evento`.

-- ─── 1. Sobre de DocuSign en el contrato ───
ALTER TABLE public.contrato
  ADD COLUMN IF NOT EXISTS docusign_envelope_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS docusign_enviado_en TIMESTAMPTZ,
  -- PDF firmado (con el certificado de finalización), descargado de DocuSign al completarse.
  ADD COLUMN IF NOT EXISTS pdf_firmado_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS pdf_firmado_sha256 CHAR(64);

ALTER TABLE public.contrato
  DROP CONSTRAINT IF EXISTS contrato_pdf_firmado_sha256_check,
  ADD CONSTRAINT contrato_pdf_firmado_sha256_check
    CHECK (pdf_firmado_sha256 IS NULL OR pdf_firmado_sha256 ~ '^[0-9a-fA-F]{64}$');

-- Un sobre pertenece a un solo contrato: el webhook lo busca por este id.
CREATE UNIQUE INDEX IF NOT EXISTS uq_contrato_docusign_envelope
  ON public.contrato (docusign_envelope_id)
  WHERE docusign_envelope_id IS NOT NULL;

-- ─── 2. Destinatario de DocuSign por firmante ───
-- `recipientId` es el número del destinatario dentro del sobre; `clientUserId` es el identificador
-- que RentAR le da para habilitar la firma embebida (tiene que repetirse al pedir la URL).
ALTER TABLE public.contrato_x_usuario
  ADD COLUMN IF NOT EXISTS docusign_recipient_id VARCHAR(20),
  ADD COLUMN IF NOT EXISTS docusign_client_user_id VARCHAR(64);

ALTER TABLE public.garante
  ADD COLUMN IF NOT EXISTS docusign_recipient_id VARCHAR(20),
  ADD COLUMN IF NOT EXISTS docusign_client_user_id VARCHAR(64);

-- ─── 3. Eventos del webhook (idempotencia) ───
-- DocuSign Connect reintenta y puede repetir o desordenar eventos. Cada evento se registra una
-- sola vez por `event_key` (sobre + tipo + destinatario + fecha del evento) y se ignora si ya
-- estaba. `payload` guarda lo recibido, para auditar una firma discutida.
CREATE TABLE IF NOT EXISTS public.docusign_evento (
  id BIGSERIAL PRIMARY KEY,
  event_key VARCHAR(200) NOT NULL UNIQUE,
  envelope_id VARCHAR(64) NOT NULL,
  tipo VARCHAR(60) NOT NULL,
  recibido_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  procesado_en TIMESTAMPTZ,
  payload JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_docusign_evento_envelope
  ON public.docusign_evento (envelope_id);

-- Todo dato pasa por apps/api con la clave de servicio: RLS activo y sin políticas.
ALTER TABLE public.docusign_evento ENABLE ROW LEVEL SECURITY;

-- ─── 4. enviar_contrato (US-05, paso 4 · enviar a firmar) ───
-- Pasa un borrador a "pendiente de firma" (estado 4) y le asigna el código CT-AAAA-NNNN, en una
-- sola transacción. La API crea el sobre de DocuSign DESPUÉS de esta función: si DocuSign falla,
-- llama a `revertir_envio_contrato`. El sobre se registra con `registrar_sobre_contrato`.
--
-- Las reglas de lo obligatorio las vuelve a validar acá (la API ya las validó con mensajes más
-- claros): la base no debe aceptar un contrato incompleto aunque otro cliente llame a la función.
--
-- Devuelve JSONB { success, statusCode, message, codigo?, contrato_codigo?, codigo_nuevo? }.
-- `codigo` identifica el motivo de un error; `contrato_codigo` es el CT-AAAA-NNNN.
CREATE OR REPLACE FUNCTION public.enviar_contrato(
    p_id_contrato INTEGER,
    p_id_locador INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_contrato public.contrato%ROWTYPE;
    v_hoy DATE := (now() AT TIME ZONE 'America/Argentina/Cordoba')::DATE;
    v_anio INTEGER;
    v_siguiente INTEGER;
    v_codigo VARCHAR(20);
    v_codigo_nuevo BOOLEAN := FALSE;
BEGIN
    -- Bloquear el contrato; la oferta (estado 1) nunca se envía.
    SELECT c.*
    INTO v_contrato
    FROM public.contrato c
    JOIN public.inmueble i ON i.id = c.id_inmueble
    WHERE c.id = p_id_contrato
      AND c.estado <> 1
      AND c.activo = TRUE
      AND i.id_locador = p_id_locador
    FOR UPDATE OF c;

    -- Inexistente y ajeno se informan igual.
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'statusCode', 404,
            'message', 'No encontramos este contrato.'
        );
    END IF;

    IF v_contrato.estado <> 5 THEN
        RETURN jsonb_build_object(
            'success', false,
            'statusCode', 409,
            'codigo', 'CONTRATO_NO_BORRADOR',
            'message', 'Solo se puede enviar a firmar un contrato en borrador.'
        );
    END IF;

    -- US-05, paso 4: para enviar a firmar tiene que estar completo.
    IF v_contrato.pdf_storage_path IS NULL THEN
        RETURN jsonb_build_object(
            'success', false, 'statusCode', 400, 'codigo', 'FALTA_PDF',
            'message', 'Cargá el PDF del contrato antes de enviarlo a firmar.'
        );
    END IF;

    IF v_contrato.fecha_inicio_contrato IS NULL
       OR v_contrato.duracion_meses IS NULL
       OR v_contrato.monto_alquiler IS NULL
       OR v_contrato.dias_para_vencimiento IS NULL
       OR (v_contrato.indice_aumento IS NOT NULL AND v_contrato.frecuencia_ajuste IS NULL)
    THEN
        RETURN jsonb_build_object(
            'success', false, 'statusCode', 400, 'codigo', 'FALTAN_CONDICIONES',
            'message', 'Completá las condiciones del contrato antes de enviarlo a firmar.'
        );
    END IF;

    -- US-05, paso 2: la fecha de inicio no puede ser anterior a la fecha actual. Se vuelve a
    -- controlar acá porque el borrador pudo guardarse días atrás.
    IF v_contrato.fecha_inicio_contrato < v_hoy THEN
        RETURN jsonb_build_object(
            'success', false, 'statusCode', 400, 'codigo', 'FECHA_INICIO_VENCIDA',
            'message', 'La fecha de inicio no puede ser anterior a la fecha actual.'
        );
    END IF;

    -- Sin locador y locatario cargados no hay a quién pedirle la firma.
    IF (
        SELECT COUNT(DISTINCT tipo_firmante)
        FROM public.contrato_x_usuario
        WHERE id_contrato = p_id_contrato AND tipo_firmante IN (1, 2)
    ) < 2 THEN
        RETURN jsonb_build_object(
            'success', false, 'statusCode', 409, 'codigo', 'FALTAN_PARTES',
            'message', 'El contrato no tiene cargados al locador y al locatario.'
        );
    END IF;

    -- Código CT-AAAA-NNNN, correlativo por año. Un contrato reabierto (US-06) conserva el suyo.
    v_codigo := v_contrato.codigo;

    IF v_codigo IS NULL THEN
        -- Serializa la numeración: dos envíos simultáneos no pueden tomar el mismo número.
        PERFORM pg_advisory_xact_lock(hashtext('contrato_codigo'));

        v_anio := EXTRACT(YEAR FROM (now() AT TIME ZONE 'America/Argentina/Cordoba'))::INTEGER;

        SELECT COALESCE(MAX(substring(codigo FROM ('^CT-' || v_anio || '-([0-9]+)$'))::INTEGER), 0) + 1
        INTO v_siguiente
        FROM public.contrato
        WHERE codigo ~ ('^CT-' || v_anio || '-[0-9]+$');

        v_codigo := 'CT-' || v_anio || '-' || lpad(v_siguiente::TEXT, 4, '0');
        v_codigo_nuevo := TRUE;
    END IF;

    UPDATE public.contrato
    SET estado = 4,
        codigo = v_codigo
    WHERE id = p_id_contrato;

    RETURN jsonb_build_object(
        'success', true,
        'statusCode', 200,
        'message', 'El contrato quedó pendiente de firma.',
        'contrato_codigo', v_codigo,
        'codigo_nuevo', v_codigo_nuevo
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.enviar_contrato(INTEGER, INTEGER) TO service_role;
REVOKE EXECUTE ON FUNCTION public.enviar_contrato(INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;

-- ─── 5. registrar_sobre_contrato ───
-- Guarda el id del sobre de DocuSign y el destinatario de cada firmante, en una transacción.
-- `p_destinatarios` es un arreglo de { tipo: 'usuario' | 'garante', id, tipo_firmante,
-- recipient_id, client_user_id }: para un usuario, `id` es `usuario.id` y `tipo_firmante` es 1
-- (locador) o 2 (locatario); para un garante, `id` es `garante.id`.
CREATE OR REPLACE FUNCTION public.registrar_sobre_contrato(
    p_id_contrato INTEGER,
    p_envelope_id VARCHAR,
    p_destinatarios JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_destinatario JSONB;
    v_actualizadas INTEGER;
BEGIN
    UPDATE public.contrato
    SET docusign_envelope_id = p_envelope_id,
        docusign_enviado_en = now()
    WHERE id = p_id_contrato
      AND estado = 4;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'statusCode', 409,
            'codigo', 'CONTRATO_NO_PENDIENTE',
            'message', 'El contrato no está pendiente de firma.'
        );
    END IF;

    FOR v_destinatario IN SELECT * FROM jsonb_array_elements(p_destinatarios)
    LOOP
        IF v_destinatario->>'tipo' = 'garante' THEN
            UPDATE public.garante
            SET docusign_recipient_id = v_destinatario->>'recipient_id',
                docusign_client_user_id = v_destinatario->>'client_user_id'
            WHERE id = (v_destinatario->>'id')::INTEGER
              AND id_contrato = p_id_contrato;
        ELSE
            UPDATE public.contrato_x_usuario
            SET docusign_recipient_id = v_destinatario->>'recipient_id',
                docusign_client_user_id = v_destinatario->>'client_user_id'
            WHERE id_contrato = p_id_contrato
              AND id_usuario = (v_destinatario->>'id')::INTEGER
              AND tipo_firmante = (v_destinatario->>'tipo_firmante')::INTEGER;
        END IF;

        GET DIAGNOSTICS v_actualizadas = ROW_COUNT;

        -- Un destinatario que no corresponde a ninguna fila cancela toda la operación.
        IF v_actualizadas = 0 THEN
            RAISE EXCEPTION 'El destinatario % no pertenece al contrato %.', v_destinatario, p_id_contrato;
        END IF;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'statusCode', 200, 'message', 'Sobre registrado.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_sobre_contrato(INTEGER, VARCHAR, JSONB) TO service_role;
REVOKE EXECUTE ON FUNCTION public.registrar_sobre_contrato(INTEGER, VARCHAR, JSONB) FROM PUBLIC, anon, authenticated;

-- ─── 6. revertir_envio_contrato ───
-- Deshace `enviar_contrato` cuando DocuSign falla: vuelve a borrador y limpia los datos del sobre.
-- Si el código se asignó en ese mismo envío (`p_quitar_codigo`), lo borra, así la numeración no
-- queda con huecos. Un contrato reabierto (US-06) conserva su código y no se borra.
-- Solo actúa si el contrato sigue pendiente de firma y NADIE firmó todavía.
CREATE OR REPLACE FUNCTION public.revertir_envio_contrato(
    p_id_contrato INTEGER,
    p_id_locador INTEGER,
    p_quitar_codigo BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.contrato_x_usuario
        WHERE id_contrato = p_id_contrato AND estado_firma = 'firmado'
    ) OR EXISTS (
        SELECT 1 FROM public.garante
        WHERE id_contrato = p_id_contrato AND estado_firma = 'firmado'
    ) THEN
        RETURN jsonb_build_object(
            'success', false, 'statusCode', 409, 'codigo', 'CONTRATO_CON_FIRMAS',
            'message', 'El contrato ya tiene firmas registradas.'
        );
    END IF;

    UPDATE public.contrato c
    SET estado = 5,
        codigo = CASE WHEN p_quitar_codigo THEN NULL ELSE c.codigo END,
        docusign_envelope_id = NULL,
        docusign_enviado_en = NULL
    FROM public.inmueble i
    WHERE c.id = p_id_contrato
      AND c.estado = 4
      AND i.id = c.id_inmueble
      AND i.id_locador = p_id_locador;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false, 'statusCode', 409, 'codigo', 'CONTRATO_NO_PENDIENTE',
            'message', 'El contrato no está pendiente de firma.'
        );
    END IF;

    UPDATE public.contrato_x_usuario
    SET docusign_recipient_id = NULL, docusign_client_user_id = NULL
    WHERE id_contrato = p_id_contrato;

    UPDATE public.garante
    SET docusign_recipient_id = NULL, docusign_client_user_id = NULL
    WHERE id_contrato = p_id_contrato;

    RETURN jsonb_build_object('success', true, 'statusCode', 200, 'message', 'El envío se revirtió.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.revertir_envio_contrato(INTEGER, INTEGER, BOOLEAN) TO service_role;
REVOKE EXECUTE ON FUNCTION public.revertir_envio_contrato(INTEGER, INTEGER, BOOLEAN) FROM PUBLIC, anon, authenticated;
