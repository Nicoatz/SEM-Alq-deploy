ALTER TABLE public.inmueble
ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.contrato
ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE;

CREATE OR REPLACE FUNCTION public.eliminar_inmueble_logico(
    p_id_inmueble INTEGER,
    p_id_locador INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_inmueble public.inmueble%ROWTYPE;
BEGIN
    -- Buscar y bloquear el inmueble durante la operación.
    SELECT *
    INTO v_inmueble
    FROM public.inmueble
    WHERE id = p_id_inmueble
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'statusCode', 404,
            'message', 'Inmueble no encontrado.'
        );
    END IF;

    -- Verificar que pertenezca al locador autenticado.
    IF v_inmueble.id_locador <> p_id_locador THEN
        RETURN jsonb_build_object(
            'success', false,
            'statusCode', 403,
            'message', 'No tenés permiso para eliminar este inmueble.'
        );
    END IF;

    -- Evitar eliminar un inmueble que ya está inactivo.
    IF NOT v_inmueble.activo THEN
        RETURN jsonb_build_object(
            'success', false,
            'statusCode', 404,
            'message', 'Inmueble no encontrado.'
        );
    END IF;

    -- Solo se permite eliminar propiedades publicadas o pausadas.
    IF v_inmueble.estado_alquiler IN ('alquilado', 'publicado/alquilado') THEN
        RETURN jsonb_build_object(
            'success', false,
            'statusCode', 409,
            'message', 'No se puede eliminar un inmueble que está alquilado.'
        );
    END IF;

    IF v_inmueble.estado_alquiler NOT IN ('publicado', 'pausado') THEN
        RETURN jsonb_build_object(
            'success', false,
            'statusCode', 409,
            'message', 'El estado del inmueble no permite eliminarlo.'
        );
    END IF;

    -- Finalizar e inactivar los contratos asociados.
    UPDATE public.contrato
    SET estado = 3,
        activo = false
    WHERE id_inmueble = p_id_inmueble;

    -- Inactivar el inmueble sin eliminarlo físicamente.
    UPDATE public.inmueble
    SET activo = false
    WHERE id = p_id_inmueble;

    RETURN jsonb_build_object(
        'success', true,
        'statusCode', 200,
        'message', 'Inmueble eliminado correctamente.'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.eliminar_inmueble_logico(INTEGER, INTEGER)
TO service_role;

REVOKE EXECUTE ON FUNCTION public.eliminar_inmueble_logico(INTEGER, INTEGER)
FROM PUBLIC, anon, authenticated;