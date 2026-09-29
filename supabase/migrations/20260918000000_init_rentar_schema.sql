
CREATE TABLE IF NOT EXISTS rol (
    id SERIAL PRIMARY KEY,
    descripcion VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS usuario (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100),
    email VARCHAR(255) NOT NULL UNIQUE,
    contrasena VARCHAR(255),
    telefono VARCHAR(50),
    fecha_nacimiento VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS usuario_x_rol (
    id SERIAL PRIMARY KEY,
    id_usuario INT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    id_rol INT NOT NULL REFERENCES rol(id) ON DELETE CASCADE,
    UNIQUE(id_usuario, id_rol)
);

CREATE TABLE IF NOT EXISTS tipo_inmueble (
    id SERIAL PRIMARY KEY,
    descripcion VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS tags_inmueble (
    id SERIAL PRIMARY KEY,
    descripcion VARCHAR(100) NOT NULL UNIQUE,
    estado BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS servicio (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS tipo_indice (
    id SERIAL PRIMARY KEY,
    descripcion VARCHAR(100) NOT NULL,
    valor NUMERIC(6, 2)
);

CREATE TABLE IF NOT EXISTS estado_contrato (
    id SERIAL PRIMARY KEY,
    descripcion VARCHAR(100) NOT NULL,
    valor BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS medio_pago (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS tipo_firmante (
    id SERIAL PRIMARY KEY,
    descripcion VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS inmueble (
    id SERIAL PRIMARY KEY,
    id_locador INT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    tipo INT NOT NULL REFERENCES tipo_inmueble(id),
    descripcion VARCHAR(500),
    provincia VARCHAR(100) NOT NULL,
    ciudad VARCHAR(100) NOT NULL,
    barrio VARCHAR(100) NOT NULL,
    direccion VARCHAR(255) NOT NULL,
    numero INT NOT NULL,
    piso VARCHAR(50),
    m2_totales INT NOT NULL,
    m2_cubiertos INT NOT NULL,
    ambientes INT NOT NULL,
    dormitorios INT NOT NULL,
    banos INT NOT NULL,
    antiguedad INT,
    precio_publicado NUMERIC(12, 2) NOT NULL,
    estado_alquiler VARCHAR(50) NOT NULL DEFAULT 'publicado',
    fecha_disponible DATE,
    servicios INT REFERENCES servicio(id)
);

CREATE TABLE IF NOT EXISTS inmueble_x_tag (
    id SERIAL PRIMARY KEY,
    id_inmueble INT NOT NULL REFERENCES inmueble(id) ON DELETE CASCADE,
    id_tag INT NOT NULL REFERENCES tags_inmueble(id) ON DELETE CASCADE,
    UNIQUE(id_inmueble, id_tag)
);

CREATE TABLE IF NOT EXISTS foto_inmueble (
    id SERIAL PRIMARY KEY,
    id_inmueble INT NOT NULL REFERENCES inmueble(id) ON DELETE CASCADE,
    url VARCHAR(500) NOT NULL,
    es_principal BOOLEAN NOT NULL DEFAULT FALSE,
    peso_kb INT NOT NULL,
    formato VARCHAR(10) NOT NULL,
    orden INT NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS contrato (
    id SERIAL PRIMARY KEY,
    id_inmueble INT NOT NULL REFERENCES inmueble(id) ON DELETE CASCADE UNIQUE,
    monto_alquiler NUMERIC(12, 2) NOT NULL,
    expensas NUMERIC(12, 2) NOT NULL,
    indice_aumento INT REFERENCES tipo_indice(id),
    frecuencia_ajuste VARCHAR(50),
    duracion_meses INT,
    deposito NUMERIC(12, 2),
    interes_por_dia NUMERIC(6, 2),
    dias_gracia INT,
    fecha_inicio_contrato DATE,
    fecha_fin_contrato DATE,
    estado INT REFERENCES estado_contrato(id)
);

CREATE TABLE IF NOT EXISTS medio_pago_x_contrato (
    id SERIAL PRIMARY KEY,
    id_contrato INT NOT NULL REFERENCES contrato(id) ON DELETE CASCADE,
    id_medio_pago INT NOT NULL REFERENCES medio_pago(id) ON DELETE CASCADE,
    UNIQUE(id_contrato, id_medio_pago)
);

CREATE TABLE IF NOT EXISTS contrato_x_usuario (
    id SERIAL PRIMARY KEY,
    id_contrato INT NOT NULL REFERENCES contrato(id) ON DELETE CASCADE,
    id_usuario INT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    tipo_firmante INT REFERENCES tipo_firmante(id)
);

CREATE INDEX IF NOT EXISTS idx_inmueble_locador ON inmueble(id_locador);
CREATE INDEX IF NOT EXISTS idx_foto_inmueble ON foto_inmueble(id_inmueble);
CREATE INDEX IF NOT EXISTS idx_inmueble_tag ON inmueble_x_tag(id_inmueble);
CREATE INDEX IF NOT EXISTS idx_contrato_inmueble ON contrato(id_inmueble);
CREATE INDEX IF NOT EXISTS idx_medio_pago_contrato ON medio_pago_x_contrato(id_contrato);
