ALTER TABLE solicitud
    DROP CONSTRAINT IF EXISTS solicitud_telefono_formato;

ALTER TABLE solicitud
    ADD CONSTRAINT solicitud_telefono_formato
    CHECK (telefono ~ '^[1-9][0-9]{9,14}$');