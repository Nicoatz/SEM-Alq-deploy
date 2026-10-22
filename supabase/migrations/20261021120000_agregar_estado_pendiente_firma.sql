INSERT INTO public.estado_contrato (id, descripcion, valor)
VALUES (4, 'pendiente de firma', TRUE)
ON CONFLICT (id) DO UPDATE
SET descripcion = EXCLUDED.descripcion,
    valor = EXCLUDED.valor;