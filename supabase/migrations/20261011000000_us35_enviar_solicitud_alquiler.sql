CREATE TABLE IF NOT EXISTS estado_solicitud (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    mensaje TEXT NULL
);

CREATE TABLE IF NOT EXISTS situacion_ocupacional (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS tipo_garantia (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS solicitud (
    id SERIAL PRIMARY KEY,
    id_inmueble INT NOT NULL REFERENCES inmueble(id) ON DELETE CASCADE,
    id_locador INT NOT NULL REFERENCES usuario(id) ON DELETE RESTRICT,
    id_locatario INT NOT NULL REFERENCES usuario(id) ON DELETE RESTRICT,
    id_estado_solicitud INT NOT NULL REFERENCES estado_solicitud(id),
    id_situacion_ocupacional INT NOT NULL REFERENCES situacion_ocupacional(id),
    mensaje TEXT NULL,
    telefono VARCHAR(30) NOT NULL,
    email VARCHAR(255) NOT NULL,
    ingresos_aprox INT NOT NULL CHECK (ingresos_aprox > 0),
    cantidad_personas INT NOT NULL CHECK (cantidad_personas >= 1),
    posee_mascotas BOOLEAN NOT NULL DEFAULT false,
    detalles_mascotas TEXT NULL,
    acepta_condiciones BOOLEAN NOT NULL DEFAULT false,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT solicitud_mensaje_max_length CHECK (mensaje IS NULL OR length(mensaje) <= 600),
    CONSTRAINT solicitud_detalles_mascotas_max_length CHECK (detalles_mascotas IS NULL OR length(detalles_mascotas) <= 300),
    CONSTRAINT solicitud_telefono_formato CHECK (telefono ~ '^\\+[1-9][0-9]{9,14}$')
);

CREATE TABLE IF NOT EXISTS solicitud_x_garantia (
    id SERIAL PRIMARY KEY,
    id_solicitud INT NOT NULL REFERENCES solicitud(id) ON DELETE CASCADE,
    id_tipo_garantia INT NOT NULL REFERENCES tipo_garantia(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_solicitud_inmueble ON solicitud(id_inmueble);
CREATE INDEX IF NOT EXISTS idx_solicitud_locador ON solicitud(id_locador);
CREATE INDEX IF NOT EXISTS idx_solicitud_locatario ON solicitud(id_locatario);
CREATE INDEX IF NOT EXISTS idx_solicitud_estado ON solicitud(id_estado_solicitud);
CREATE INDEX IF NOT EXISTS idx_solicitud_fecha_creacion ON solicitud(fecha_creacion);
CREATE INDEX IF NOT EXISTS idx_solicitud_x_garantia_solicitud ON solicitud_x_garantia(id_solicitud);
CREATE INDEX IF NOT EXISTS idx_solicitud_x_garantia_tipo ON solicitud_x_garantia(id_tipo_garantia);

INSERT INTO estado_solicitud (id, nombre, mensaje)
VALUES
    (1, 'pendiente', NULL),
    (2, 'aceptada', NULL),
    (3, 'rechazada', 'La solicitud fue rechazada por el locador.'),
    (4, 'cancelada', 'La solicitud fue cancelada por el usuario.')
ON CONFLICT (id) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    mensaje = EXCLUDED.mensaje;

INSERT INTO situacion_ocupacional (id, nombre)
VALUES
    (1, '-'),
    (2, 'relación de dependencia'),
    (3, 'monotributista'),
    (4, 'autónoma'),
    (5, 'estudiante'),
    (6, 'jubilada')
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre;

INSERT INTO tipo_garantia (id, nombre)
VALUES
    (1, 'garantía propietaria'),
    (2, 'seguro de caución'),
    (3, 'otra')
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre;

SELECT setval(
    pg_get_serial_sequence('estado_solicitud', 'id'),
    COALESCE(MAX(id), 1)
)
FROM estado_solicitud;

SELECT setval(
    pg_get_serial_sequence('situacion_ocupacional', 'id'),
    COALESCE(MAX(id), 1)
)
FROM situacion_ocupacional;

SELECT setval(
    pg_get_serial_sequence('tipo_garantia', 'id'),
    COALESCE(MAX(id), 1)
)
FROM tipo_garantia;

SELECT setval(
    pg_get_serial_sequence('solicitud', 'id'),
    COALESCE(MAX(id), 1)
)
FROM solicitud;

SELECT setval(
    pg_get_serial_sequence('solicitud_x_garantia', 'id'),
    COALESCE(MAX(id), 1)
)
FROM solicitud_x_garantia;
