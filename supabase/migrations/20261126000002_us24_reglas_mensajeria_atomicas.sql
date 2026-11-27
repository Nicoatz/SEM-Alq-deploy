-- US-24: una conversación no-reclamo activa por participantes y propiedad.
CREATE UNIQUE INDEX IF NOT EXISTS uq_conversacion_no_reclamo_activa
  ON public.conversacion (id_locador, id_locatario, (COALESCE(id_inmueble, 0)))
  WHERE tipo_tema <> 'reclamo' AND activo;

-- Cada reclamo conserva su propia conversación, incluso si hay otros chats entre las partes.
CREATE UNIQUE INDEX IF NOT EXISTS uq_conversacion_reclamo
  ON public.conversacion (id_reclamo)
  WHERE id_reclamo IS NOT NULL;

-- Devuelve solo conteo y último mensaje para evitar cargar el historial del listado.
CREATE OR REPLACE FUNCTION public.resumen_mensajes_conversaciones(p_ids_conversacion INTEGER[])
RETURNS TABLE (
  id_conversacion INTEGER,
  total_mensajes BIGINT,
  ultimo_id BIGINT,
  ultimo_contenido TEXT,
  ultimo_fecha_envio TIMESTAMPTZ,
  ultimo_id_emisor INTEGER,
  ultimo_eliminado BOOLEAN
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    conversacion.id,
    conteo.total,
    ultimo.id,
    ultimo.contenido,
    ultimo.fecha_envio,
    ultimo.id_emisor,
    ultimo.eliminado
  FROM unnest(p_ids_conversacion) AS conversacion(id)
  CROSS JOIN LATERAL (
    SELECT count(*) AS total
    FROM public.mensaje
    WHERE mensaje.id_conversacion = conversacion.id
  ) AS conteo
  LEFT JOIN LATERAL (
    SELECT mensaje.id, mensaje.contenido, mensaje.fecha_envio, mensaje.id_emisor, mensaje.eliminado
    FROM public.mensaje
    WHERE mensaje.id_conversacion = conversacion.id
    ORDER BY mensaje.fecha_envio DESC, mensaje.id DESC
    LIMIT 1
  ) AS ultimo ON true;
$$;

-- US-18 / US-24: inserta el mensaje y transiciona el reclamo dentro de la misma transacción.
CREATE OR REPLACE FUNCTION public.enviar_mensaje_reclamo(
  p_id_conversacion INTEGER,
  p_id_emisor INTEGER,
  p_contenido TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_conversacion public.conversacion%ROWTYPE;
  v_reclamo RECORD;
  v_mensaje public.mensaje%ROWTYPE;
BEGIN
  IF p_contenido IS NULL OR char_length(trim(p_contenido)) = 0 THEN
    RAISE EXCEPTION 'El mensaje no puede estar vacío.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_conversacion
  FROM public.conversacion
  WHERE id = p_id_conversacion AND activo
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La conversación no existe o está inactiva.' USING ERRCODE = 'P0002';
  END IF;

  IF v_conversacion.tipo_tema <> 'reclamo' OR v_conversacion.id_reclamo IS NULL THEN
    RAISE EXCEPTION 'La conversación no está asociada a un reclamo.' USING ERRCODE = '22023';
  END IF;

  SELECT reclamo.id_locatario, reclamo.id_estado_reclamo, inmueble.id_locador
  INTO v_reclamo
  FROM public.reclamo AS reclamo
  JOIN public.inmueble AS inmueble ON inmueble.id = reclamo.id_inmueble
  WHERE reclamo.id = v_conversacion.id_reclamo
  FOR UPDATE OF reclamo;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El reclamo asociado no existe.' USING ERRCODE = 'P0002';
  END IF;

  IF v_reclamo.id_locatario <> v_conversacion.id_locatario
    OR v_reclamo.id_locador <> v_conversacion.id_locador THEN
    RAISE EXCEPTION 'Los participantes no corresponden al reclamo.' USING ERRCODE = '42501';
  END IF;

  IF p_id_emisor = v_conversacion.id_locador THEN
    IF v_reclamo.id_estado_reclamo NOT IN (1, 2) THEN
      RAISE EXCEPTION 'ESTADO_INVALIDO' USING ERRCODE = 'P0001';
    END IF;

    IF v_reclamo.id_estado_reclamo = 1 THEN
      UPDATE public.reclamo
      SET id_estado_reclamo = 2,
          fecha_actualizacion = now()
      WHERE id = v_conversacion.id_reclamo
        AND id_estado_reclamo = 1;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'ESTADO_INVALIDO' USING ERRCODE = 'P0001';
      END IF;
    END IF;
  ELSIF p_id_emisor = v_conversacion.id_locatario THEN
    IF v_reclamo.id_estado_reclamo <> 2 THEN
      RAISE EXCEPTION 'ESTADO_INVALIDO' USING ERRCODE = 'P0001';
    END IF;
  ELSE
    RAISE EXCEPTION 'El emisor no participa en la conversación.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.mensaje (id_conversacion, id_emisor, contenido)
  VALUES (p_id_conversacion, p_id_emisor, trim(p_contenido))
  RETURNING * INTO v_mensaje;

  RETURN to_jsonb(v_mensaje);
END;
$$;

-- Los chats de reclamo quedan en solo lectura fuera de los estados permitidos.
CREATE OR REPLACE FUNCTION public.eliminar_mensaje_reclamo(
  p_id_mensaje BIGINT,
  p_id_emisor INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_mensaje public.mensaje%ROWTYPE;
  v_conversacion public.conversacion%ROWTYPE;
  v_reclamo RECORD;
BEGIN
  SELECT * INTO v_mensaje
  FROM public.mensaje
  WHERE id = p_id_mensaje;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El mensaje no existe.' USING ERRCODE = 'P0002';
  END IF;

  IF v_mensaje.eliminado THEN
    RAISE EXCEPTION 'MENSAJE_YA_ELIMINADO' USING ERRCODE = 'P0001';
  END IF;

  IF v_mensaje.id_emisor <> p_id_emisor THEN
    RAISE EXCEPTION 'No puedes eliminar un mensaje de otro participante.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_conversacion
  FROM public.conversacion
  WHERE id = v_mensaje.id_conversacion AND activo
  FOR UPDATE;

  IF NOT FOUND OR v_conversacion.tipo_tema <> 'reclamo' OR v_conversacion.id_reclamo IS NULL THEN
    RAISE EXCEPTION 'La conversación de reclamo no existe o está inactiva.' USING ERRCODE = 'P0002';
  END IF;

  SELECT reclamo.id_locatario, reclamo.id_estado_reclamo, inmueble.id_locador
  INTO v_reclamo
  FROM public.reclamo AS reclamo
  JOIN public.inmueble AS inmueble ON inmueble.id = reclamo.id_inmueble
  WHERE reclamo.id = v_conversacion.id_reclamo
  FOR UPDATE OF reclamo;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El reclamo asociado no existe.' USING ERRCODE = 'P0002';
  END IF;

  IF v_conversacion.id_locatario <> v_reclamo.id_locatario
    OR v_conversacion.id_locador <> v_reclamo.id_locador THEN
    RAISE EXCEPTION 'Los participantes no corresponden al reclamo.' USING ERRCODE = '42501';
  END IF;

  IF (p_id_emisor = v_conversacion.id_locador AND v_reclamo.id_estado_reclamo NOT IN (1, 2))
    OR (p_id_emisor = v_conversacion.id_locatario AND v_reclamo.id_estado_reclamo <> 2)
    OR p_id_emisor NOT IN (v_conversacion.id_locador, v_conversacion.id_locatario) THEN
    RAISE EXCEPTION 'ESTADO_INVALIDO' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.mensaje
  SET eliminado = true,
      fecha_eliminacion = now()
  WHERE id = p_id_mensaje
    AND id_emisor = p_id_emisor
    AND NOT eliminado;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MENSAJE_YA_ELIMINADO' USING ERRCODE = 'P0001';
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.enviar_mensaje_reclamo(INTEGER, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enviar_mensaje_reclamo(INTEGER, INTEGER, TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.eliminar_mensaje_reclamo(BIGINT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eliminar_mensaje_reclamo(BIGINT, INTEGER) TO service_role;
REVOKE ALL ON FUNCTION public.resumen_mensajes_conversaciones(INTEGER[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resumen_mensajes_conversaciones(INTEGER[]) TO service_role;

-- Permite que el navegador confirme y borre las fotos propias cuando falla el alta del reclamo.
DROP POLICY IF EXISTS "ver fotos reclamos propias" ON storage.objects;
CREATE POLICY "ver fotos reclamos propias"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'fotos-reclamos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );