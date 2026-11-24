-- US-18: prepara el chat de reclamos existentes que todavía no tenían conversación.
-- Los reclamos nuevos crean su conversación desde ReclamoService al registrarse.
INSERT INTO public.conversacion (
  id_locador,
  id_locatario,
  iniciado_por,
  tipo_tema,
  asunto,
  id_inmueble,
  id_reclamo,
  id_contrato,
  activo,
  fecha_creacion,
  fecha_actualizacion
)
SELECT
  inmueble.id_locador,
  reclamo.id_locatario,
  reclamo.id_locatario,
  'reclamo',
  reclamo.titulo,
  reclamo.id_inmueble,
  reclamo.id,
  reclamo.id_contrato,
  true,
  reclamo.fecha_creacion,
  reclamo.fecha_actualizacion
FROM public.reclamo AS reclamo
JOIN public.inmueble AS inmueble ON inmueble.id = reclamo.id_inmueble
WHERE NOT EXISTS (
  SELECT 1
  FROM public.conversacion
  WHERE conversacion.id_reclamo = reclamo.id
);