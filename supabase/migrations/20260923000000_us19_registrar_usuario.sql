ALTER TABLE usuario
    ADD COLUMN IF NOT EXISTS numero_documento VARCHAR(50),
    ADD COLUMN IF NOT EXISTS auth_user_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS uq_usuario_numero_documento
    ON usuario(numero_documento)
    WHERE numero_documento IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_usuario_auth_user_id
    ON usuario(auth_user_id)
    WHERE auth_user_id IS NOT NULL;

INSERT INTO rol (id, descripcion)
VALUES (0, 'locatario')
ON CONFLICT (id) DO UPDATE SET descripcion = EXCLUDED.descripcion;