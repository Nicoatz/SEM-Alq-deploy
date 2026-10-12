ALTER TABLE solicitud
    ALTER COLUMN ingresos_aprox DROP NOT NULL;

ALTER TABLE solicitud
    ADD COLUMN IF NOT EXISTS fecha_respuesta TIMESTAMPTZ NULL;