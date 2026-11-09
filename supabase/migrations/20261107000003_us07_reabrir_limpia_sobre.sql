-- US-07 · Modificar un contrato pendiente de firma desvincula su sobre de DocuSign
--
-- Misma función `reabrir_contrato` de 20261104000000 (US-06). La única diferencia: además de
-- borrar las firmas y devolver el contrato a borrador, limpia lo que guardó el envío a firmar
-- (id del sobre y destinatarios de DocuSign). El sobre en sí se anula desde la API; si quedara sin
-- anular, ya no está asociado a ningún contrato y el webhook lo ignora. Al volver a enviar a
-- firmar se crea un sobre nuevo.

CREATE OR REPLACE FUNCTION public.reabrir_contrato(
    p_id_contrato INTEGER,
    p_id_locador INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_contrato public.contrato%ROWTYPE;
BEGIN
    -- Bloquear el contrato; la oferta (estado 1) nunca se modifica por acá.
    SELECT c.*
    INTO v_contrato
    FROM public.contrato c
    JOIN public.inmueble i ON i.id = c.id_inmueble
    WHERE c.id = p_id_contrato
      AND c.estado <> 1
      AND c.activo = TRUE
      AND i.id_locador = p_id_locador
    FOR UPDATE OF c;

    -- US-06: inexistente y ajeno se informan igual.
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'statusCode', 404,
            'message', 'No encontramos este contrato.'
        );
    END IF;

    -- US-06: los contratos vigentes o finalizados no se modifican; se explica el motivo.
    IF v_contrato.estado = 2 THEN
        RETURN jsonb_build_object(
            'success', false,
            'statusCode', 409,
            'codigo', 'CONTRATO_VIGENTE',
            'message', 'No se puede modificar un contrato vigente: todas las partes ya lo firmaron.'
        );
    END IF;

    IF v_contrato.estado = 3 THEN
        RETURN jsonb_build_object(
            'success', false,
            'statusCode', 409,
            'codigo', 'CONTRATO_FINALIZADO',
            'message', 'No se puede modificar un contrato finalizado.'
        );
    END IF;

    -- Ya es un borrador: no hay nada que reabrir (se retoma con PATCH).
    IF v_contrato.estado = 5 THEN
        RETURN jsonb_build_object(
            'success', false,
            'statusCode', 409,
            'codigo', 'CONTRATO_YA_EN_BORRADOR',
            'message', 'El contrato ya está en borrador.'
        );
    END IF;

    -- US-06: con la firma del locatario no se puede modificar. La conformidad que ya dio el
    -- locatario tampoco se puede borrar (la base lo impide), así que cuenta como intervención.
    IF EXISTS (
        SELECT 1
        FROM public.contrato_x_usuario
        WHERE id_contrato = p_id_contrato
          AND tipo_firmante = 2
          AND (estado_firma = 'firmado' OR fecha_conformidad IS NOT NULL)
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'statusCode', 409,
            'codigo', 'CONTRATO_FIRMADO_POR_LOCATARIO',
            'message', 'No se puede modificar un contrato que el locatario ya firmó.'
        );
    END IF;

    -- US-06: se borran las firmas registradas, de las partes y de los garantes. US-07: también los
    -- destinatarios del sobre de DocuSign, que deja de valer.
    UPDATE public.contrato_x_usuario
    SET estado_firma = 'pendiente',
        fecha_firma = NULL,
        fecha_rechazo = NULL,
        hash_documento_firmado = NULL,
        ip_firma = NULL,
        motivo_rechazo = NULL,
        docusign_recipient_id = NULL,
        docusign_client_user_id = NULL
    WHERE id_contrato = p_id_contrato;

    -- Los enlaces de firma emitidos a los garantes dejan de servir (se cancela el envío).
    UPDATE public.garante
    SET estado_firma = 'pendiente',
        fecha_firma = NULL,
        fecha_rechazo = NULL,
        hash_documento_firmado = NULL,
        ip_firma = NULL,
        motivo_rechazo = NULL,
        token_firma_hash = NULL,
        token_vence_en = NULL,
        docusign_recipient_id = NULL,
        docusign_client_user_id = NULL
    WHERE id_contrato = p_id_contrato;

    -- US-06: vuelve a borrador y conserva su código (no se toca `codigo`).
    UPDATE public.contrato
    SET estado = 5,
        ultimo_paso_borrador = 1,
        docusign_envelope_id = NULL,
        docusign_enviado_en = NULL
    WHERE id = p_id_contrato;

    RETURN jsonb_build_object(
        'success', true,
        'statusCode', 200,
        'message', 'El contrato volvió a borrador.'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reabrir_contrato(INTEGER, INTEGER) TO service_role;
REVOKE EXECUTE ON FUNCTION public.reabrir_contrato(INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
