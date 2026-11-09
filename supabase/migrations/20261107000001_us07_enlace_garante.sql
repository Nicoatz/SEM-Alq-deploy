-- US-07 · Enlace de firma del garante
--
-- Los garantes no son usuarios de RentAR: firman con un enlace temporal que el locador les
-- entrega por su cuenta (no hay mails). El token vive en `garante.token_firma_hash` (solo el
-- hash, nunca el token) y en `garante.token_vence_en`, columnas que existen desde US-05.
--
-- `generar_enlace_garante` guarda el hash del token nuevo. Pedir otro enlace pisa el anterior,
-- que deja de servir. Devuelve JSONB { success, statusCode, message, codigo? }, igual que el resto
-- de las funciones de contrato.

CREATE OR REPLACE FUNCTION public.generar_enlace_garante(
    p_id_contrato INTEGER,
    p_id_garante INTEGER,
    p_id_locador INTEGER,
    p_token_hash TEXT,
    p_vence_en TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_contrato public.contrato%ROWTYPE;
    v_garante public.garante%ROWTYPE;
BEGIN
    -- Bloquear el contrato; la oferta (estado 1) no tiene firmas.
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

    -- Solo se genera el enlace con el contrato enviado a firmar.
    IF v_contrato.estado <> 4 THEN
        RETURN jsonb_build_object(
            'success', false,
            'statusCode', 409,
            'codigo', 'CONTRATO_NO_PENDIENTE',
            'message', 'El contrato no está pendiente de firma.'
        );
    END IF;

    SELECT *
    INTO v_garante
    FROM public.garante
    WHERE id = p_id_garante
      AND id_contrato = p_id_contrato
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'statusCode', 404,
            'message', 'No encontramos este garante.'
        );
    END IF;

    -- Una parte no firma dos veces: a quien ya firmó no se le genera otro enlace.
    IF v_garante.estado_firma <> 'pendiente' THEN
        RETURN jsonb_build_object(
            'success', false,
            'statusCode', 409,
            'codigo', 'YA_FIRMO',
            'message', 'Este garante ya firmó el contrato.'
        );
    END IF;

    -- Sin destinatario en el sobre no hay a dónde mandar la firma.
    IF v_garante.docusign_recipient_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'statusCode', 409,
            'codigo', 'SOBRE_NO_DISPONIBLE',
            'message', 'El contrato todavía no tiene el sobre de firma listo.'
        );
    END IF;

    UPDATE public.garante
    SET token_firma_hash = p_token_hash,
        token_vence_en = p_vence_en
    WHERE id = p_id_garante;

    RETURN jsonb_build_object(
        'success', true,
        'statusCode', 200,
        'message', 'Enlace generado.'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.generar_enlace_garante(INTEGER, INTEGER, INTEGER, TEXT, TIMESTAMPTZ) TO service_role;
REVOKE EXECUTE ON FUNCTION public.generar_enlace_garante(INTEGER, INTEGER, INTEGER, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
