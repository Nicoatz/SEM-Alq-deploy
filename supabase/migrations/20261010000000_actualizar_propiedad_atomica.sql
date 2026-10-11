sql
CREATE OR REPLACE FUNCTION public.actualizar_propiedad_completa(
    p_id_inmueble INTEGER,
    p_id_locador INTEGER,
    p_data JSONB
)
RETURNS SETOF inmueble
LANGUAGE plpgsql
AS $function$
DECLARE
    v_inmueble public.inmueble%ROWTYPE;
    v_foto JSONB;
    v_tiene_principal BOOLEAN;
    v_cantidad_fotos INTEGER;
BEGIN
    -- Validar el formato de los datos recibidos.
    IF p_data IS NULL OR jsonb_typeof(p_data) <> 'object' THEN
        RAISE EXCEPTION 'Los datos de la propiedad deben ser un objeto JSON.';
    END IF;

    -- No permitir cambios de estado ni datos contractuales.
    IF p_data ?| ARRAY[
        'estado_alquiler',
        'condiciones_contrato',
        'contrato',
        'monto_alquiler',
        'expensas',
        'indice_aumento',
        'frecuencia_ajuste',
        'duracion_meses',
        'deposito',
        'interes_por_dia',
        'dias_gracia',
        'medios_pago'
    ] THEN
        RAISE EXCEPTION
            'La edición no permite modificar el estado ni los datos del contrato.';
    END IF;

    -- Buscar y bloquear el inmueble durante la operación.
    SELECT *
    INTO v_inmueble
    FROM public.inmueble
    WHERE id = p_id_inmueble
      AND activo = TRUE
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Inmueble no encontrado o inactivo.';
    END IF;

    -- Verificar la propiedad del inmueble.
    IF v_inmueble.id_locador <> p_id_locador THEN
        RAISE EXCEPTION 'El inmueble no pertenece a este locador.';
    END IF;

    -- No permitir modificar propiedades alquiladas.
    IF v_inmueble.estado_alquiler IN (
        'alquilado',
        'publicado/alquilado'
    ) THEN
        RAISE EXCEPTION
            'No se puede modificar una propiedad que está alquilada.';
    END IF;

    -- Validar fotos solo si el cliente envió la lista.
    IF p_data ? 'fotos' THEN
        IF jsonb_typeof(p_data->'fotos') <> 'array' THEN
            RAISE EXCEPTION 'Las fotos deben enviarse como una lista.';
        END IF;

        v_cantidad_fotos := jsonb_array_length(p_data->'fotos');

        IF v_cantidad_fotos < 3 OR v_cantidad_fotos > 50 THEN
            RAISE EXCEPTION
                'La propiedad debe tener entre 3 y 50 fotos.';
        END IF;

        IF EXISTS (
            SELECT 1
            FROM jsonb_array_elements(p_data->'fotos') AS f(value)
            WHERE NULLIF(f.value->>'url', '') IS NULL
               OR NULLIF(f.value->>'formato', '') IS NULL
               OR COALESCE(
                    NULLIF(f.value->>'peso_kb', '')::INTEGER,
                    0
                  ) <= 0
        ) THEN
            RAISE EXCEPTION
                'Cada foto debe tener URL, formato y peso válido.';
        END IF;

        IF (
            SELECT COUNT(*)
            FROM jsonb_array_elements(p_data->'fotos') AS f(value)
            WHERE COALESCE(
                (f.value->>'es_principal')::BOOLEAN,
                FALSE
            )
        ) > 1 THEN
            RAISE EXCEPTION
                'Solo puede existir una foto principal.';
        END IF;
    END IF;

    -- Validar tags solo si el cliente envió la lista.
    IF p_data ? 'tags'
       AND jsonb_typeof(p_data->'tags') <> 'array' THEN
        RAISE EXCEPTION 'Los tags deben enviarse como una lista.';
    END IF;

    -- Actualizar exclusivamente las columnas editables.
    -- Las claves omitidas conservan su valor anterior.
    UPDATE public.inmueble
    SET
        tipo = CASE
            WHEN p_data ? 'tipo'
            THEN (p_data->>'tipo')::INTEGER
            ELSE tipo
        END,
        descripcion = CASE
            WHEN p_data ? 'descripcion'
            THEN p_data->>'descripcion'
            ELSE descripcion
        END,
        provincia = CASE
            WHEN p_data ? 'provincia'
            THEN p_data->>'provincia'
            ELSE provincia
        END,
        ciudad = CASE
            WHEN p_data ? 'ciudad'
            THEN p_data->>'ciudad'
            ELSE ciudad
        END,
        barrio = CASE
            WHEN p_data ? 'barrio'
            THEN p_data->>'barrio'
            ELSE barrio
        END,
        direccion = CASE
            WHEN p_data ? 'direccion'
            THEN p_data->>'direccion'
            ELSE direccion
        END,
        numero = CASE
            WHEN p_data ? 'numero'
            THEN (p_data->>'numero')::INTEGER
            ELSE numero
        END,
        piso = CASE
            WHEN p_data ? 'piso'
            THEN NULLIF(p_data->>'piso', '')
            ELSE piso
        END,
        m2_totales = CASE
            WHEN p_data ? 'm2_totales'
            THEN (p_data->>'m2_totales')::INTEGER
            ELSE m2_totales
        END,
        m2_cubiertos = CASE
            WHEN p_data ? 'm2_cubiertos'
            THEN (p_data->>'m2_cubiertos')::INTEGER
            ELSE m2_cubiertos
        END,
        ambientes = CASE
            WHEN p_data ? 'ambientes'
            THEN (p_data->>'ambientes')::INTEGER
            ELSE ambientes
        END,
        dormitorios = CASE
            WHEN p_data ? 'dormitorios'
            THEN (p_data->>'dormitorios')::INTEGER
            ELSE dormitorios
        END,
        banos = CASE
            WHEN p_data ? 'banos'
            THEN (p_data->>'banos')::INTEGER
            ELSE banos
        END,
        antiguedad = CASE
            WHEN p_data ? 'antiguedad'
            THEN NULLIF(p_data->>'antiguedad', '')::INTEGER
            ELSE antiguedad
        END,
        precio_publicado = CASE
            WHEN p_data ? 'precio_publicado'
            THEN (p_data->>'precio_publicado')::NUMERIC
            ELSE precio_publicado
        END,
        fecha_disponible = CASE
            WHEN p_data ? 'fecha_disponible'
            THEN NULLIF(p_data->>'fecha_disponible', '')::DATE
            ELSE fecha_disponible
        END,
        servicios = CASE
            WHEN p_data ? 'servicios'
            THEN NULLIF(p_data->>'servicios', '')::INTEGER
            ELSE servicios
        END
    WHERE id = p_id_inmueble
    RETURNING * INTO v_inmueble;

    -- Reemplazar fotos solo cuando se recibió la lista.
    IF p_data ? 'fotos' THEN
        DELETE FROM public.foto_inmueble
        WHERE id_inmueble = p_id_inmueble;

        v_tiene_principal := EXISTS (
            SELECT 1
            FROM jsonb_array_elements(p_data->'fotos') AS f(value)
            WHERE COALESCE(
                (f.value->>'es_principal')::BOOLEAN,
                FALSE
            )
        );

        FOR v_foto IN
            SELECT value
            FROM jsonb_array_elements(p_data->'fotos')
        LOOP
            INSERT INTO public.foto_inmueble (
                id_inmueble,
                url,
                es_principal,
                peso_kb,
                formato,
                orden
            )
            VALUES (
                p_id_inmueble,
                v_foto->>'url',
                CASE
                    WHEN v_tiene_principal
                    THEN COALESCE(
                        (v_foto->>'es_principal')::BOOLEAN,
                        FALSE
                    )
                    ELSE NOT EXISTS (
                        SELECT 1
                        FROM public.foto_inmueble
                        WHERE id_inmueble = p_id_inmueble
                    )
                END,
                (v_foto->>'peso_kb')::INTEGER,
                LOWER(v_foto->>'formato'),
                (
                    SELECT COUNT(*) + 1
                    FROM public.foto_inmueble
                    WHERE id_inmueble = p_id_inmueble
                )
            );
        END LOOP;
    END IF;

    -- Reemplazar tags solo cuando se recibió la lista.
    IF p_data ? 'tags' THEN
        DELETE FROM public.inmueble_x_tag
        WHERE id_inmueble = p_id_inmueble;

        INSERT INTO public.inmueble_x_tag (
            id_inmueble,
            id_tag
        )
        SELECT
            p_id_inmueble,
            tag_id
        FROM (
            SELECT DISTINCT value::INTEGER AS tag_id
            FROM jsonb_array_elements_text(p_data->'tags')
        ) AS tags_recibidos;
    END IF;

    -- Devolver el inmueble actualizado.
    RETURN QUERY
    SELECT *
    FROM public.inmueble
    WHERE id = p_id_inmueble;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.actualizar_propiedad_completa(INTEGER, INTEGER, JSONB)
TO service_role;

REVOKE EXECUTE ON FUNCTION public.actualizar_propiedad_completa(INTEGER, INTEGER, JSONB)
FROM PUBLIC, anon, authenticated;
