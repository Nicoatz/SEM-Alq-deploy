UPDATE inmueble
SET estado_alquiler = 'publicado/alquilado'
WHERE estado_alquiler IN ('alquilada/publicada', 'alquilado/publicado');