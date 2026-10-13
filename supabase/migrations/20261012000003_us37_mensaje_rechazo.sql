ALTER TABLE solicitud
    ADD COLUMN IF NOT EXISTS mensaje_rechazo VARCHAR(200) NULL;

ALTER TABLE solicitud
    DROP CONSTRAINT IF EXISTS solicitud_mensaje_rechazo_max_length;

ALTER TABLE solicitud
    ADD CONSTRAINT solicitud_mensaje_rechazo_max_length
    CHECK (mensaje_rechazo IS NULL OR length(mensaje_rechazo) <= 200);