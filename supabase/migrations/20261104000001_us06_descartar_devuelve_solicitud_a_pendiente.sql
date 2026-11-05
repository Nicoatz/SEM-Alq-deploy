-- US-06 · Descartar un borrador: la solicitud de origen vuelve a "pendiente".
--
-- Antes: al descartar un borrador la solicitud quedaba "aceptada", sin contrato. Con la regla de
-- una sola solicitud aceptada por propiedad (US-37), esa solicitud bloqueaba que el locador
-- aceptara a otro locatario, y el locatario no podía volver a postularse (una solicitud
-- aceptada cuenta como activa).
--
-- Ahora: si el contrato se cae, la solicitud vuelve a estar pendiente (estado 1), como si el
-- locador todavía no hubiera respondido. Puede aceptarla de nuevo o elegir a otra persona.
-- Todo en la misma transacción que el borrado del borrador.
--
-- Solo se toca una solicitud que siga "aceptada" (estado 2): una anterior al contrato (sin
-- `id_solicitud`) o ya cambiada no se modifica.

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

    -- La solicitud que originó el borrador vuelve a pendiente.
    IF v_contrato.id_solicitud IS NOT NULL THEN
        UPDATE public.solicitud
        SET id_estado_solicitud = 1,
            fecha_respuesta = NULL,
            mensaje_rechazo = NULL,
            fecha_actualizacion = NOW()
        WHERE id = v_contrato.id_solicitud
          AND id_estado_solicitud = 2;
    END IF;

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
