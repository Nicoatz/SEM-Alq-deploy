-- US-06 · Modificar contrato de alquiler (contrato en curso, no la oferta)
--
-- 1. `reabrir_contrato`: un contrato pendiente de firma, sin la firma del locatario, vuelve a
--    borrador (cancela el envío, borra las firmas y conserva su código CT-AAAA-NNNN).
-- 2. `descartar_borrador_contrato`: elimina un borrador y libera la solicitud de origen.
--
-- La edición en sí (4 pasos, mismas validaciones que el alta) es la de US-05: un contrato
-- reabierto es un borrador más. La propiedad y el locatario no se pueden cambiar porque
-- ninguna función los toca: vienen de la solicitud de origen.

-- ─── 1. reabrir_contrato ───
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

    -- US-06: se borran las firmas registradas, de las partes y de los garantes.
    UPDATE public.contrato_x_usuario
    SET estado_firma = 'pendiente',
        fecha_firma = NULL,
        fecha_rechazo = NULL,
        hash_documento_firmado = NULL,
        ip_firma = NULL,
        motivo_rechazo = NULL
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
        token_vence_en = NULL
    WHERE id_contrato = p_id_contrato;

    -- US-06: vuelve a borrador y conserva su código (no se toca `codigo`).
    UPDATE public.contrato
    SET estado = 5,
        ultimo_paso_borrador = 1
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

-- ─── 2. descartar_borrador_contrato ───
-- Elimina el borrador con sus garantes, medios de pago, y partes (en cascada). La
-- solicitud queda libre para originar un contrato nuevo (`id_solicitud` es único).
CREATE OR REPLACE FUNCTION public.descartar_borrador_contrato(
    p_id_contrato INTEGER,
    p_id_locador INTEGER
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

    -- US-06: solo se descarta un borrador.
    IF v_contrato.estado <> 5 THEN
        RETURN jsonb_build_object(
            'success', false,
            'statusCode', 409,
            'codigo', 'CONTRATO_NO_EDITABLE',
            'message', 'Solo se puede descartar un contrato en borrador.'
        );
    END IF;

    DELETE FROM public.contrato WHERE id = p_id_contrato;

    RETURN jsonb_build_object(
        'success', true,
        'statusCode', 200,
        'message', 'Borrador descartado correctamente.',
        'pdf_anterior', v_contrato.pdf_storage_path
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.descartar_borrador_contrato(INTEGER, INTEGER) TO service_role;
REVOKE EXECUTE ON FUNCTION public.descartar_borrador_contrato(INTEGER, INTEGER)
    FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
