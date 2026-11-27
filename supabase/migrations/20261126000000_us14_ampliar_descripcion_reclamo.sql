-- US-14: la validación del servicio permite descripciones de hasta 5000 caracteres.
ALTER TABLE public.reclamo
  ALTER COLUMN descripcion TYPE VARCHAR(5000);