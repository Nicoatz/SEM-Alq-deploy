-- =============================================================================
-- RentAR - Datos Semilla Actualizados (seed.sql)
-- =============================================================================

-- Catálogos
INSERT INTO rol (id, descripcion) VALUES
(0, 'locatario'),
(1, 'locador'),
(2, 'administrador')
ON CONFLICT ("id") DO NOTHING;

INSERT INTO tipo_inmueble (id, descripcion) VALUES
(1, 'Departamento'),
(2, 'Casa'),
(3, 'PH'),
(4, 'Monoambiente')
ON CONFLICT ("id") DO NOTHING;

INSERT INTO tags_inmueble (id, descripcion, estado) VALUES
(1, 'Acepta mascotas', TRUE),
(2, 'Con cochera', TRUE),
(3, 'Amoblado', TRUE),
(4, 'Balcón con vista abierta', TRUE)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO servicio (id, nombre, descripcion) VALUES
(1, 'Luz', 'Suministro de energía eléctrica'),
(2, 'Gas natural', 'Red de gas natural'),
(3, 'Agua corriente', 'Suministro de agua potable'),
(4, 'Internet', 'Conexión fibra óptica')
ON CONFLICT ("id") DO NOTHING;

INSERT INTO tipo_indice (id, descripcion, valor) VALUES
(1, 'ICL (Índice de Contratos de Locación)', 4.5),
(2, 'IPC (Índice de Precios al Consumidor)', 3.8),
(3, 'CAC (Cámara Argentina de la Construcción)', 5.1)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO estado_contrato (id, descripcion, valor) VALUES
(1, 'disponible', TRUE),
(2, 'vigente', TRUE),
(3, 'finalizado', FALSE)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO medio_pago (id, nombre, descripcion) VALUES
(1, 'Transferencia bancaria', 'Transferencia directa a CBU/CVU'),
(2, 'Efectivo', 'Pago presencial en efectivo'),
(3, 'Mercado Pago', 'Pasarela digital de Mercado Pago'),
(4, 'Débito automático', 'Débito automático en cuenta bancaria')
ON CONFLICT ("id") DO NOTHING;

INSERT INTO tipo_firmante (id, descripcion) VALUES
(1, 'Locador principal'),
(2, 'Locatario principal'),
(3, 'Garante')
ON CONFLICT ("id") DO NOTHING;

-- Usuarios
INSERT INTO usuario (id, nombre, apellido, email, numero_documento, telefono) VALUES
(1, 'Carlos', 'Propietario', 'locador@rentar.com', '30111222', '3511112233'),
(2, 'Ana', 'Inquilina', 'locatario@rentar.com', '30222333', '3514445566'),
(3, 'Segundo', 'Locador', 'otro.locador@rentar.com', '30333444', '3517778899')
ON CONFLICT ("id") DO NOTHING;

INSERT INTO usuario_x_rol (id_usuario, id_rol) VALUES
(1, 1),
(2, 0),
(3, 1)
ON CONFLICT ("id_usuario", "id_rol") DO NOTHING;

-- Inmueble 1: Carlos (Disponible, precio publicado 360000, contrato 350000)
INSERT INTO inmueble (id, id_locador, tipo, descripcion, provincia, ciudad, barrio, direccion, numero, piso, m2_totales, m2_cubiertos, ambientes, dormitorios, banos, antiguedad, precio_publicado, estado_alquiler, servicios) VALUES
(1, 1, 1, 'Hermoso departamento luminoso con balcón', 'Córdoba', 'Córdoba', 'Alberdi', 'Av. Colón', 1550, '4B', 70, 65, 3, 2, 1, 5, 360000.00, 'publicado', 4);

INSERT INTO inmueble_x_tag (id_inmueble, id_tag) VALUES
(1, 1),
(1, 4);

INSERT INTO foto_inmueble (id_inmueble, url, es_principal, peso_kb, formato, orden) VALUES
(1, 'https://rentar.com/fotos/1-frente.jpg', TRUE, 180, 'jpg', 1),
(1, 'https://rentar.com/fotos/1-living.jpg', FALSE, 210, 'jpg', 2),
(1, 'https://rentar.com/fotos/1-dormitorio.png', FALSE, 320, 'png', 3);

INSERT INTO contrato (id, id_inmueble, monto_alquiler, expensas, indice_aumento, frecuencia_ajuste, duracion_meses, deposito, interes_por_dia, dias_gracia, fecha_inicio_contrato, fecha_fin_contrato, estado) VALUES
(1, 1, 350000.00, 45000.00, 1, 'Semestral', 24, 350000.00, 0.5, 5, '2026-10-01', '2028-09-30', 1);

INSERT INTO medio_pago_x_contrato (id_contrato, id_medio_pago) VALUES
(1, 1),
(1, 3);


-- Inmueble 2: Carlos (Alquilado con fecha disponible)
INSERT INTO inmueble (id, id_locador, tipo, descripcion, provincia, ciudad, barrio, direccion, numero, piso, m2_totales, m2_cubiertos, ambientes, dormitorios, banos, antiguedad, precio_publicado, estado_alquiler, fecha_disponible, servicios) VALUES
(2, 1, 1, 'Departamento en Nueva Córdoba', 'Córdoba', 'Córdoba', 'Nueva Córdoba', 'Bv. Chacabuco', 720, '2A', 52, 48, 2, 1, 1, 3, 290000.00, 'alquilado', '2028-03-01', 1);

INSERT INTO inmueble_x_tag (id_inmueble, id_tag) VALUES
(2, 2);

INSERT INTO foto_inmueble (id_inmueble, url, es_principal, peso_kb, formato, orden) VALUES
(2, 'https://rentar.com/fotos/2-portada.jpg', TRUE, 195, 'jpg', 1),
(2, 'https://rentar.com/fotos/2-comedor.jpg', FALSE, 250, 'jpg', 2),
(2, 'https://rentar.com/fotos/2-cocina.png', FALSE, 280, 'png', 3);

INSERT INTO contrato (id, id_inmueble, monto_alquiler, expensas, indice_aumento, frecuencia_ajuste, duracion_meses, deposito, interes_por_dia, dias_gracia, fecha_inicio_contrato, fecha_fin_contrato, estado) VALUES
(2, 2, 290000.00, 38000.00, 1, 'Anual', 24, 290000.00, 0.5, 3, '2026-03-01', '2028-02-28', 2);

INSERT INTO medio_pago_x_contrato (id_contrato, id_medio_pago) VALUES
(2, 1);

INSERT INTO contrato_x_usuario (id_contrato, id_usuario, tipo_firmante) VALUES
(2, 1, 1),
(2, 2, 2);

-- Ajuste de secuencias
SELECT setval(pg_get_serial_sequence('rol', 'id'), coalesce(max(id), 1)) FROM rol;
SELECT setval(pg_get_serial_sequence('tipo_inmueble', 'id'), coalesce(max(id), 1)) FROM tipo_inmueble;
SELECT setval(pg_get_serial_sequence('tags_inmueble', 'id'), coalesce(max(id), 1)) FROM tags_inmueble;
SELECT setval(pg_get_serial_sequence('servicio', 'id'), coalesce(max(id), 1)) FROM servicio;
SELECT setval(pg_get_serial_sequence('tipo_indice', 'id'), coalesce(max(id), 1)) FROM tipo_indice;
SELECT setval(pg_get_serial_sequence('estado_contrato', 'id'), coalesce(max(id), 1)) FROM estado_contrato;
SELECT setval(pg_get_serial_sequence('medio_pago', 'id'), coalesce(max(id), 1)) FROM medio_pago;
SELECT setval(pg_get_serial_sequence('tipo_firmante', 'id'), coalesce(max(id), 1)) FROM tipo_firmante;
SELECT setval(pg_get_serial_sequence('usuario', 'id'), coalesce(max(id), 1)) FROM usuario;
SELECT setval(pg_get_serial_sequence('inmueble', 'id'), coalesce(max(id), 1)) FROM inmueble;
SELECT setval(pg_get_serial_sequence('inmueble_x_tag', 'id'), coalesce(max(id), 1)) FROM inmueble_x_tag;
SELECT setval(pg_get_serial_sequence('contrato', 'id'), coalesce(max(id), 1)) FROM contrato;
SELECT setval(pg_get_serial_sequence('foto_inmueble', 'id'), coalesce(max(id), 1)) FROM foto_inmueble;
SELECT setval(pg_get_serial_sequence('medio_pago_x_contrato', 'id'), coalesce(max(id), 1)) FROM medio_pago_x_contrato;
SELECT setval(pg_get_serial_sequence('contrato_x_usuario', 'id'), coalesce(max(id), 1)) FROM contrato_x_usuario;
