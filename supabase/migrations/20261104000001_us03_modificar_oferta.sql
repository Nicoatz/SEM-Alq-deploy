-- US-03 · Modificar propiedad: ahora también modifica la OFERTA
--
-- La oferta (fila de `contrato` con estado 1) guarda las condiciones comerciales de la
-- publicación. Para el locador es una sola pantalla; en la base son dos tablas, así que
-- `actualizar_propiedad_completa` acepta `condiciones_contrato` y las aplica en la misma
-- transacción que los datos de la propiedad. Se puede enviar solo uno de los dos bloques.
--   · El monto de la oferta y `inmueble.precio_publicado` se mantienen iguales (se cierra la
--     observación anotada en gestion_contrato.md, sección 3).
--   · El contrato en curso (borrador / pendiente de firma / vigente) nunca se modifica.
--   · Una propiedad alquilada no se puede modificar (ni su oferta): regla existente de US-03.
-- Misma función de 20261010000000, más el bloque "Oferta".

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
    v_cond JSONB;
    v_oferta public.contrato%ROWTYPE;
    v_monto NUMERIC;
BEGIN
    -- Validar el formato de los datos recibidos.
    IF p_data IS NULL OR jsonb_typeof(p_data) <> 'object' THEN
        RAISE EXCEPTION 'Los datos de la propiedad deben ser un objeto JSON.';
    END IF;

    -- No permitir cambios de estado ni datos contractuales sueltos. Las condiciones de la oferta
    -- viajan agrupadas en `condiciones_contrato` (ver más abajo).
    IF p_data ?| ARRAY[
        'estado_alquiler',
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

    -- ─── Oferta (condiciones comerciales de la publicación) ───
    -- La oferta es la fila de `contrato` con estado 1: la ficha que ve el público. Se puede
    -- modificar junto con la propiedad o sola (enviando solo `condiciones_contrato`). El contrato
    -- en curso (borrador, pendiente de firma o vigente) NO se toca: lo negociado no cambia.
    -- Todo ocurre en esta misma transacción: si algo falla, no se guarda nada.
    IF p_data ? 'condiciones_contrato' THEN
        IF jsonb_typeof(p_data->'condiciones_contrato') <> 'object' THEN
            RAISE EXCEPTION 'Las condiciones del contrato deben enviarse como un objeto.';
        END IF;
        v_cond := p_data->'condiciones_contrato';
    END IF;

    IF v_cond IS NOT NULL OR p_data ? 'precio_publicado' THEN
        SELECT *
        INTO v_oferta
        FROM public.contrato
        WHERE id_inmueble = p_id_inmueble
          AND estado = 1
          AND activo = TRUE
        FOR UPDATE;

        IF NOT FOUND AND v_cond IS NOT NULL THEN
            RAISE EXCEPTION 'La propiedad no tiene condiciones de oferta cargadas.';
        END IF;
    END IF;

    IF v_oferta.id IS NOT NULL THEN
        -- El monto de la oferta y el precio publicado son el mismo dato: se mantienen iguales.
        IF v_cond ? 'monto_alquiler' THEN
            IF jsonb_typeof(v_cond->'monto_alquiler') <> 'number'
               OR (v_cond->>'monto_alquiler')::NUMERIC <= 0 THEN
                RAISE EXCEPTION 'El monto de alquiler debe ser un número mayor a 0.';
            END IF;
            v_monto := (v_cond->>'monto_alquiler')::NUMERIC;

            IF p_data ? 'precio_publicado'
               AND (p_data->>'precio_publicado')::NUMERIC <> v_monto THEN
                RAISE EXCEPTION
                    'El precio publicado y el monto de alquiler de las condiciones deben coincidir.';
            END IF;
        ELSIF p_data ? 'precio_publicado' THEN
            v_monto := (p_data->>'precio_publicado')::NUMERIC;
        END IF;

        IF v_cond ? 'expensas'
           AND (jsonb_typeof(v_cond->'expensas') <> 'number'
                OR (v_cond->>'expensas')::NUMERIC < 0) THEN
            RAISE EXCEPTION 'El monto de las expensas debe ser un número mayor o igual a 0.';
        END IF;

        IF v_cond ? 'duracion_meses'
           AND NULLIF(v_cond->>'duracion_meses', '') IS NOT NULL
           AND (v_cond->>'duracion_meses')::INTEGER <= 0 THEN
            RAISE EXCEPTION 'La duración del contrato debe ser mayor a 0.';
        END IF;

        IF v_cond ? 'deposito'
           AND NULLIF(v_cond->>'deposito', '') IS NOT NULL
           AND (v_cond->>'deposito')::NUMERIC < 0 THEN
            RAISE EXCEPTION 'El depósito no puede ser negativo.';
        END IF;

        IF v_cond ? 'medios_pago' AND (
            jsonb_typeof(v_cond->'medios_pago') <> 'array'
            OR jsonb_array_length(v_cond->'medios_pago') = 0
        ) THEN
            RAISE EXCEPTION 'Se debe indicar al menos un medio de pago.';
        END IF;

        UPDATE public.contrato
        SET monto_alquiler = COALESCE(v_monto, monto_alquiler),
            expensas = CASE
                WHEN v_cond ? 'expensas' THEN (v_cond->>'expensas')::NUMERIC
                ELSE expensas
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
            duracion_meses = CASE
                WHEN v_cond ? 'duracion_meses'
                THEN NULLIF(v_cond->>'duracion_meses', '')::INTEGER
                ELSE duracion_meses
            END,
            deposito = CASE
                WHEN v_cond ? 'deposito'
                THEN NULLIF(v_cond->>'deposito', '')::NUMERIC
                ELSE deposito
            END,
            interes_por_dia = CASE
                WHEN v_cond ? 'interes_por_dia'
                THEN NULLIF(v_cond->>'interes_por_dia', '')::NUMERIC
                ELSE interes_por_dia
            END,
            dias_gracia = CASE
                WHEN v_cond ? 'dias_gracia'
                THEN NULLIF(v_cond->>'dias_gracia', '')::INTEGER
                ELSE dias_gracia
            END
        WHERE id = v_oferta.id
        RETURNING * INTO v_oferta;

        -- US-01: si hay interés por día, tienen que estar los días de gracia (con lo ya guardado).
        IF COALESCE(v_oferta.interes_por_dia, 0) > 0 AND v_oferta.dias_gracia IS NULL THEN
            RAISE EXCEPTION 'Si se indicó el interés por día, se deben indicar los días de gracia.';
        END IF;

        IF v_cond ? 'medios_pago' THEN
            DELETE FROM public.medio_pago_x_contrato WHERE id_contrato = v_oferta.id;

            INSERT INTO public.medio_pago_x_contrato (id_contrato, id_medio_pago)
            SELECT DISTINCT v_oferta.id, value::INTEGER
            FROM jsonb_array_elements_text(v_cond->'medios_pago');
        END IF;

        -- El precio publicado de la propiedad sigue al monto de la oferta.
        IF v_monto IS NOT NULL THEN
            UPDATE public.inmueble
            SET precio_publicado = v_monto
            WHERE id = p_id_inmueble;
        END IF;
    END IF;

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

NOTIFY pgrst, 'reload schema';
