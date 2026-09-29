CREATE TABLE IF NOT EXISTS estado_reclamo (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS reclamo (
    id SERIAL PRIMARY KEY,
    id_inmueble INT NOT NULL REFERENCES inmueble(id) ON DELETE CASCADE,
    titulo VARCHAR(255) NOT NULL,
    descripcion VARCHAR(1000) NOT NULL,
    id_estado_reclamo INT NOT NULL REFERENCES estado_reclamo(id)
);

CREATE INDEX IF NOT EXISTS idx_reclamo_inmueble ON reclamo(id_inmueble);
CREATE INDEX IF NOT EXISTS idx_reclamo_estado ON reclamo(id_estado_reclamo);

INSERT INTO estado_reclamo (id, nombre)
VALUES
    (1, 'pendiente'),
    (2, 'en_proceso'),
    (3, 'resuelto')
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre;

SELECT setval(
    pg_get_serial_sequence('estado_reclamo', 'id'),
    COALESCE(MAX(id), 1)
)
FROM estado_reclamo;
