CREATE OR REPLACE FUNCTION public.registrar_propiedad_completa(
    p_id_locador INTEGER,
    p_data JSONB
)
RETURNS SETOF inmueble
LANGUAGE plpgsql
AS $$
DECLARE
    v_inmueble inmueble%ROWTYPE;
    v_contrato contrato%ROWTYPE;
    v_foto JSONB;
    v_tiene_principal BOOLEAN;
BEGIN
    INSERT INTO inmueble (
        id_locador,
        tipo,
        descripcion,
        provincia,
        ciudad,
        barrio,
        direccion,
        numero,
        piso,
        m2_totales,
        m2_cubiertos,
        ambientes,
        dormitorios,
        banos,
        antiguedad,
        precio_publicado,
        estado_alquiler,
        fecha_disponible,
        servicios
    )
    VALUES (
        p_id_locador,
        (p_data->>'tipo')::INTEGER,
        p_data->>'descripcion',
        p_data->>'provincia',
        p_data->>'ciudad',
        p_data->>'barrio',
        p_data->>'direccion',
        (p_data->>'numero')::INTEGER,
        NULLIF(p_data->>'piso', '') ,
        (p_data->>'m2_totales')::INTEGER,
        (p_data->>'m2_cubiertos')::INTEGER,
        (p_data->>'ambientes')::INTEGER,
        (p_data->>'dormitorios')::INTEGER,
        (p_data->>'banos')::INTEGER,
        NULLIF(p_data->>'antiguedad', '')::INTEGER,
        (p_data->>'precio_publicado')::NUMERIC,
        p_data->>'estado_alquiler',
        NULLIF(p_data->>'fecha_disponible', '')::DATE,
        NULLIF(p_data->>'servicios', '')::INTEGER
    )
    RETURNING * INTO v_inmueble;

    v_tiene_principal := EXISTS (
        SELECT 1
        FROM jsonb_array_elements(COALESCE(p_data->'fotos', '[]'::JSONB)) AS foto
        WHERE COALESCE((foto->>'es_principal')::BOOLEAN, FALSE)
    );

    FOR v_foto IN
        SELECT value
        FROM jsonb_array_elements(COALESCE(p_data->'fotos', '[]'::JSONB))
    LOOP
        INSERT INTO foto_inmueble (
            id_inmueble,
            url,
            es_principal,
            peso_kb,
            formato,
            orden
        )
        VALUES (
            v_inmueble.id,
            v_foto->>'url',
            CASE
                WHEN v_tiene_principal THEN COALESCE((v_foto->>'es_principal')::BOOLEAN, FALSE)
                ELSE NOT EXISTS (
                    SELECT 1
                    FROM foto_inmueble
                    WHERE id_inmueble = v_inmueble.id
                )
            END,
            (v_foto->>'peso_kb')::INTEGER,
            LOWER(v_foto->>'formato'),
            (SELECT COUNT(*) + 1 FROM foto_inmueble WHERE id_inmueble = v_inmueble.id)
        );
    END LOOP;

    INSERT INTO inmueble_x_tag (id_inmueble, id_tag)
    SELECT v_inmueble.id, value::INTEGER
    FROM jsonb_array_elements_text(COALESCE(p_data->'tags', '[]'::JSONB));

    INSERT INTO contrato (
        id_inmueble,
        monto_alquiler,
        expensas,
        indice_aumento,
        frecuencia_ajuste,
        duracion_meses,
        deposito,
        interes_por_dia,
        dias_gracia,
        fecha_inicio_contrato,
        fecha_fin_contrato,
        estado
    )
    VALUES (
        v_inmueble.id,
        (p_data->'condiciones_contrato'->>'monto_alquiler')::NUMERIC,
        (p_data->'condiciones_contrato'->>'expensas')::NUMERIC,
        NULLIF(p_data->'condiciones_contrato'->>'indice_aumento', '')::INTEGER,
        NULLIF(p_data->'condiciones_contrato'->>'frecuencia_ajuste', ''),
        NULLIF(p_data->'condiciones_contrato'->>'duracion_meses', '')::INTEGER,
        NULLIF(p_data->'condiciones_contrato'->>'deposito', '')::NUMERIC,
        NULLIF(p_data->'condiciones_contrato'->>'interes_por_dia', '')::NUMERIC,
        NULLIF(p_data->'condiciones_contrato'->>'dias_gracia', '')::INTEGER,
        NULLIF(p_data->'condiciones_contrato'->>'fecha_inicio_contrato', '')::DATE,
        NULLIF(p_data->'condiciones_contrato'->>'fecha_fin_contrato', '')::DATE,
        1
    )
    RETURNING * INTO v_contrato;

    INSERT INTO medio_pago_x_contrato (id_contrato, id_medio_pago)
    SELECT v_contrato.id, value::INTEGER
    FROM jsonb_array_elements_text(
        COALESCE(p_data->'condiciones_contrato'->'medios_pago', '[]'::JSONB)
    );

    INSERT INTO usuario_x_rol (id_usuario, id_rol)
    VALUES (p_id_locador, 1)
    ON CONFLICT (id_usuario, id_rol) DO NOTHING;

    RETURN NEXT v_inmueble;
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_propiedad_completa(INTEGER, JSONB) TO service_role;
REVOKE EXECUTE ON FUNCTION public.registrar_propiedad_completa(INTEGER, JSONB) FROM PUBLIC, anon, authenticated;
