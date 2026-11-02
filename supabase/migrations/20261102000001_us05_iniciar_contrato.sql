-- US-05 · Iniciar contrato (crea el borrador desde una solicitud aceptada)
--
-- Crea el CONTRATO EN CURSO en estado 5 "borrador" a partir de la OFERTA del inmueble (estado 1),
-- que no se toca (ver docs/gestion_contrato.md). Todo en una transacción:
--   · fila nueva en `contrato` (estado 5) con los valores por defecto de la US-05;
--   · medios de pago copiados de la oferta (el paso 2 los muestra en solo lectura);
--   · las dos partes en `contrato_x_usuario` (locador = tipo 1, locatario = tipo 2).
-- Las cláusulas y los garantes se cargan después, al guardar el borrador (Paso 5).
--
-- Devuelve JSONB { success, statusCode, message, contrato_id? }, igual que
-- eliminar_inmueble_logico, para que la API traduzca cada regla a su status HTTP.

CREATE OR REPLACE FUNCTION public.iniciar_contrato(
    p_id_solicitud INTEGER,
    p_id_locador INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_solicitud public.solicitud%ROWTYPE;
    v_inmueble public.inmueble%ROWTYPE;
    v_oferta public.contrato%ROWTYPE;
    v_en_curso public.contrato%ROWTYPE;
    v_contrato_id INTEGER;
BEGIN
    -- Bloquear la solicitud: dos clics seguidos no pueden crear dos contratos.
    SELECT *
    INTO v_solicitud
    FROM public.solicitud
    WHERE id = p_id_solicitud
    FOR UPDATE;

    -- Una solicitud ajena se informa como inexistente, para no revelar que existe.
    IF NOT FOUND OR v_solicitud.id_locador <> p_id_locador THEN
        RETURN jsonb_build_object(
            'success', false,
            'statusCode', 404,
            'message', 'La solicitud no existe o no pertenece al locador.'
        );
    END IF;

    -- US-05: el contrato se inicia solo desde una solicitud aceptada (estado 2).
    IF v_solicitud.id_estado_solicitud <> 2 THEN
        RETURN jsonb_build_object(
            'success', false,
            'statusCode', 409,
            'message', 'Solo se puede iniciar un contrato desde una solicitud aceptada.'
        );
    END IF;

    -- US-05: una solicitud aceptada puede originar un solo contrato.
    IF EXISTS (
        SELECT 1 FROM public.contrato WHERE id_solicitud = p_id_solicitud
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'statusCode', 409,
            'message', 'Esta solicitud ya originó un contrato.'
        );
    END IF;

    SELECT *
    INTO v_inmueble
    FROM public.inmueble
    WHERE id = v_solicitud.id_inmueble
    FOR UPDATE;

    IF NOT FOUND OR NOT v_inmueble.activo THEN
        RETURN jsonb_build_object(
            'success', false,
            'statusCode', 404,
            'message', 'La propiedad no existe.'
        );
    END IF;

    -- US-05: la propiedad no debe tener un contrato vigente ni pendiente de firma. Un borrador
    -- tampoco: solo hay un contrato en curso por propiedad.
    SELECT *
    INTO v_en_curso
    FROM public.contrato
    WHERE id_inmueble = v_inmueble.id
      AND estado IN (2, 4, 5)
      AND activo = TRUE
    LIMIT 1;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'statusCode', 409,
            'message', CASE v_en_curso.estado
                WHEN 5 THEN 'La propiedad ya tiene un contrato en borrador.'
                ELSE 'La propiedad ya tiene un contrato vigente o pendiente de firma.'
            END
        );
    END IF;

    -- Las condiciones de partida salen de la oferta (lo que está publicado).
    SELECT *
    INTO v_oferta
    FROM public.contrato
    WHERE id_inmueble = v_inmueble.id
      AND estado = 1
      AND activo = TRUE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'statusCode', 409,
            'message', 'La propiedad no tiene condiciones de oferta cargadas.'
        );
    END IF;

    BEGIN
        INSERT INTO public.contrato (
            id_inmueble,
            monto_alquiler,
            expensas,
            indice_aumento,
            frecuencia_ajuste,
            duracion_meses,
            deposito,
            interes_por_dia,
            dias_gracia,
            dias_para_vencimiento,
            estado,
            id_solicitud,
            ultimo_paso_borrador
        )
        VALUES (
            v_inmueble.id,
            -- US-05, paso 2: el monto inicial precarga el precio publicado.
            v_oferta.monto_alquiler,
            v_oferta.expensas,
            v_oferta.indice_aumento,
            -- US-05, paso 2: la periodicidad es trimestral, semestral o anual. La publicación
            -- guarda texto libre ("Semestral", "Cuatrimestral"): se normaliza o queda vacía
            -- para que el locador la elija.
            CASE
                WHEN lower(v_oferta.frecuencia_ajuste) IN ('trimestral', 'semestral', 'anual')
                THEN lower(v_oferta.frecuencia_ajuste)
                ELSE NULL
            END,
            -- US-05, paso 2: la duración por defecto es de 24 meses.
            24,
            -- US-05, paso 2: el depósito por defecto equivale a un mes de alquiler.
            v_oferta.monto_alquiler,
            v_oferta.interes_por_dia,
            v_oferta.dias_gracia,
            -- US-05, paso 2: el día de vencimiento del pago por defecto es el 10.
            10,
            5,
            p_id_solicitud,
            1
        )
        RETURNING id INTO v_contrato_id;
    EXCEPTION WHEN unique_violation THEN
        -- Otro pedido ganó la carrera (la misma solicitud o la misma propiedad).
        RETURN jsonb_build_object(
            'success', false,
            'statusCode', 409,
            'message', 'Ya existe un contrato para esta solicitud o propiedad.'
        );
    END;

    -- US-05, paso 2: los medios de pago de la propiedad se muestran en solo lectura.
    INSERT INTO public.medio_pago_x_contrato (id_contrato, id_medio_pago)
    SELECT v_contrato_id, id_medio_pago
    FROM public.medio_pago_x_contrato
    WHERE id_contrato = v_oferta.id;

    -- US-05, paso 1: el locador y el locatario vienen precargados (tipo 1 y tipo 2).
    INSERT INTO public.contrato_x_usuario (id_contrato, id_usuario, tipo_firmante)
    VALUES
        (v_contrato_id, v_solicitud.id_locador, 1),
        (v_contrato_id, v_solicitud.id_locatario, 2);

    RETURN jsonb_build_object(
        'success', true,
        'statusCode', 201,
        'message', 'Contrato iniciado correctamente.',
        'contrato_id', v_contrato_id
    );
END;
$$;

-- Solo la API (clave de servicio) puede llamarla: no queda expuesta a anon ni a authenticated.
GRANT EXECUTE ON FUNCTION public.iniciar_contrato(INTEGER, INTEGER) TO service_role;
REVOKE EXECUTE ON FUNCTION public.iniciar_contrato(INTEGER, INTEGER)
    FROM PUBLIC, anon, authenticated;
