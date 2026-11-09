-- US-07 · Registro de firmas desde el webhook de DocuSign
--
-- La API no confía en lo que dice el webhook: cuando DocuSign avisa, la API le pregunta a DocuSign
-- el estado real del sobre y recién ahí llama a estas funciones. Cada una es idempotente (DocuSign
-- reintenta y puede repetir avisos) y devuelve JSONB { success, statusCode, message, codigo? }, igual
-- que el resto de las funciones de contrato. Todas buscan el contrato por el id de su sobre.
--
--   · registrar_firma_contrato    · una persona firmó: fecha, IP y hash del documento.
--   · registrar_rechazo_contrato  · una persona rechazó: el contrato vuelve a borrador.
--   · completar_contrato          · firmaron todos: el contrato pasa a vigente.

-- ─── 1. registrar_firma_contrato ───
-- Marca como firmado al firmante (locador, locatario o garante) cuyo destinatario es
-- `p_recipient_id`. La base exige fecha, hash e IP para el estado "firmado" (CHECK de US-27).
-- Si ya estaba firmado no hace nada y responde `ya_registrada`. A un garante que firma se le
-- invalida el enlace temporal.
CREATE OR REPLACE FUNCTION public.registrar_firma_contrato(
    p_envelope_id VARCHAR,
    p_recipient_id VARCHAR,
    p_fecha_firma TIMESTAMPTZ,
    p_ip TEXT,
    p_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_contrato public.contrato%ROWTYPE;
    v_actualizadas INTEGER;
BEGIN
    -- Bloquear el contrato: dos avisos simultáneos no pueden pisarse.
    SELECT *
    INTO v_contrato
    FROM public.contrato
    WHERE docusign_envelope_id = p_envelope_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false, 'statusCode', 404, 'codigo', 'SOBRE_DESCONOCIDO',
            'message', 'No hay un contrato con este sobre.'
        );
    END IF;

    IF v_contrato.estado <> 4 THEN
        RETURN jsonb_build_object(
            'success', false, 'statusCode', 409, 'codigo', 'CONTRATO_NO_PENDIENTE',
            'message', 'El contrato no está pendiente de firma.'
        );
    END IF;

    UPDATE public.contrato_x_usuario
    SET estado_firma = 'firmado',
        fecha_firma = p_fecha_firma,
        hash_documento_firmado = p_hash,
        ip_firma = p_ip::INET
    WHERE id_contrato = v_contrato.id
      AND docusign_recipient_id = p_recipient_id
      AND estado_firma = 'pendiente';

    GET DIAGNOSTICS v_actualizadas = ROW_COUNT;

    IF v_actualizadas = 0 THEN
        UPDATE public.garante
        SET estado_firma = 'firmado',
            fecha_firma = p_fecha_firma,
            hash_documento_firmado = p_hash,
            ip_firma = p_ip::INET,
            -- El enlace temporal ya cumplió su función.
            token_firma_hash = NULL,
            token_vence_en = NULL
        WHERE id_contrato = v_contrato.id
          AND docusign_recipient_id = p_recipient_id
          AND estado_firma = 'pendiente';

        GET DIAGNOSTICS v_actualizadas = ROW_COUNT;
    END IF;

    IF v_actualizadas = 0 THEN
        -- O ya estaba firmado (aviso repetido) o ese destinatario no es de este contrato.
        IF EXISTS (
            SELECT 1 FROM public.contrato_x_usuario
            WHERE id_contrato = v_contrato.id AND docusign_recipient_id = p_recipient_id
              AND estado_firma = 'firmado'
        ) OR EXISTS (
            SELECT 1 FROM public.garante
            WHERE id_contrato = v_contrato.id AND docusign_recipient_id = p_recipient_id
              AND estado_firma = 'firmado'
        ) THEN
            RETURN jsonb_build_object(
                'success', true, 'statusCode', 200, 'ya_registrada', true,
                'id_contrato', v_contrato.id, 'message', 'La firma ya estaba registrada.'
            );
        END IF;

        RETURN jsonb_build_object(
            'success', false, 'statusCode', 404, 'codigo', 'FIRMANTE_DESCONOCIDO',
            'message', 'El destinatario no pertenece al contrato.'
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true, 'statusCode', 200, 'ya_registrada', false,
        'id_contrato', v_contrato.id, 'message', 'Firma registrada.'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_firma_contrato(VARCHAR, VARCHAR, TIMESTAMPTZ, TEXT, TEXT) TO service_role;
REVOKE EXECUTE ON FUNCTION public.registrar_firma_contrato(VARCHAR, VARCHAR, TIMESTAMPTZ, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- ─── 2. registrar_rechazo_contrato ───
-- US-07: al rechazar la firma el contrato vuelve a "borrador" y se borran las firmas registradas.
-- Conserva el código CT-AAAA-NNNN (igual que `reabrir_contrato`, US-06). El sobre de DocuSign
-- queda terminado del lado de DocuSign: se desvincula, y al volver a enviar se crea uno nuevo.
-- El motivo del rechazo no se guarda en el contrato: queda en `docusign_evento.payload`.
CREATE OR REPLACE FUNCTION public.registrar_rechazo_contrato(
    p_envelope_id VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_contrato public.contrato%ROWTYPE;
BEGIN
    SELECT *
    INTO v_contrato
    FROM public.contrato
    WHERE docusign_envelope_id = p_envelope_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false, 'statusCode', 404, 'codigo', 'SOBRE_DESCONOCIDO',
            'message', 'No hay un contrato con este sobre.'
        );
    END IF;

    -- Un rechazo sobre un contrato que ya no está pendiente (por ejemplo, ya se reabrió) no hace nada.
    IF v_contrato.estado <> 4 THEN
        RETURN jsonb_build_object(
            'success', false, 'statusCode', 409, 'codigo', 'CONTRATO_NO_PENDIENTE',
            'message', 'El contrato no está pendiente de firma.'
        );
    END IF;

    UPDATE public.contrato_x_usuario
    SET estado_firma = 'pendiente',
        fecha_firma = NULL,
        fecha_rechazo = NULL,
        hash_documento_firmado = NULL,
        ip_firma = NULL,
        motivo_rechazo = NULL,
        docusign_recipient_id = NULL,
        docusign_client_user_id = NULL
    WHERE id_contrato = v_contrato.id;

    -- Los enlaces de firma de los garantes dejan de servir.
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
    WHERE id_contrato = v_contrato.id;

    UPDATE public.contrato
    SET estado = 5,
        ultimo_paso_borrador = 1,
        docusign_envelope_id = NULL,
        docusign_enviado_en = NULL
    WHERE id = v_contrato.id;

    RETURN jsonb_build_object(
        'success', true, 'statusCode', 200,
        'id_contrato', v_contrato.id, 'message', 'El contrato volvió a borrador.'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_rechazo_contrato(VARCHAR) TO service_role;
REVOKE EXECUTE ON FUNCTION public.registrar_rechazo_contrato(VARCHAR) FROM PUBLIC, anon, authenticated;

-- ─── 3. completar_contrato ───
-- US-07, "Contrato vigente": cuando firman el locador, el locatario y todos los garantes, en UNA
-- transacción:
--   · el contrato pasa a vigente (estado 2). Un trigger de US-08 genera los períodos de cobro;
--   · la propiedad pasa a "alquilado" y deja de aparecer en la búsqueda;
--   · las solicitudes pendientes de la propiedad pasan a rechazadas, con el mensaje automático;
--   · se invalidan los enlaces de firma que quedaran.
-- Si falta alguna firma no hace nada (409 FIRMAS_INCOMPLETAS). Es idempotente.
CREATE OR REPLACE FUNCTION public.completar_contrato(
    p_envelope_id VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_contrato public.contrato%ROWTYPE;
BEGIN
    SELECT *
    INTO v_contrato
    FROM public.contrato
    WHERE docusign_envelope_id = p_envelope_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false, 'statusCode', 404, 'codigo', 'SOBRE_DESCONOCIDO',
            'message', 'No hay un contrato con este sobre.'
        );
    END IF;

    -- Aviso repetido: ya está vigente.
    IF v_contrato.estado = 2 THEN
        RETURN jsonb_build_object(
            'success', true, 'statusCode', 200, 'ya_completado', true,
            'id_contrato', v_contrato.id, 'message', 'El contrato ya estaba vigente.'
        );
    END IF;

    IF v_contrato.estado <> 4 THEN
        RETURN jsonb_build_object(
            'success', false, 'statusCode', 409, 'codigo', 'CONTRATO_NO_PENDIENTE',
            'message', 'El contrato no está pendiente de firma.'
        );
    END IF;

    IF (
        SELECT COUNT(DISTINCT tipo_firmante)
        FROM public.contrato_x_usuario
        WHERE id_contrato = v_contrato.id AND tipo_firmante IN (1, 2) AND estado_firma = 'firmado'
    ) < 2
    OR EXISTS (
        SELECT 1 FROM public.contrato_x_usuario
        WHERE id_contrato = v_contrato.id AND tipo_firmante IN (1, 2) AND estado_firma <> 'firmado'
    )
    OR EXISTS (
        SELECT 1 FROM public.garante
        WHERE id_contrato = v_contrato.id AND estado_firma <> 'firmado'
    ) THEN
        RETURN jsonb_build_object(
            'success', false, 'statusCode', 409, 'codigo', 'FIRMAS_INCOMPLETAS',
            'message', 'Todavía faltan firmas.'
        );
    END IF;

    UPDATE public.contrato
    SET estado = 2
    WHERE id = v_contrato.id;

    UPDATE public.inmueble
    SET estado_alquiler = 'alquilado'
    WHERE id = v_contrato.id_inmueble;

    -- Las solicitudes ya respondidas (la aceptada del contrato, las canceladas) no se tocan.
    UPDATE public.solicitud
    SET id_estado_solicitud = 3,
        mensaje_rechazo = 'La propiedad ya fue alquilada.',
        fecha_respuesta = now()
    WHERE id_inmueble = v_contrato.id_inmueble
      AND id_estado_solicitud = 1;

    UPDATE public.garante
    SET token_firma_hash = NULL,
        token_vence_en = NULL
    WHERE id_contrato = v_contrato.id;

    RETURN jsonb_build_object(
        'success', true, 'statusCode', 200, 'ya_completado', false,
        'id_contrato', v_contrato.id, 'message', 'El contrato quedó vigente.'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.completar_contrato(VARCHAR) TO service_role;
REVOKE EXECUTE ON FUNCTION public.completar_contrato(VARCHAR) FROM PUBLIC, anon, authenticated;
