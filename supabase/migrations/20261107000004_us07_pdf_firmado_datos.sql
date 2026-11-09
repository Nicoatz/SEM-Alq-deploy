-- US-07 · Datos del PDF firmado
--
-- La migración 20261107000000 agregó `pdf_firmado_storage_path` y `pdf_firmado_sha256`. Para mostrar
-- el documento firmado igual que el original (nombre, tamaño y fecha) faltan el tamaño y cuándo se
-- guardó. Sin ellos habría que inventar un tamaño o dejarlo vacío.

ALTER TABLE public.contrato
  ADD COLUMN IF NOT EXISTS pdf_firmado_tamano_bytes INTEGER,
  ADD COLUMN IF NOT EXISTS pdf_firmado_en TIMESTAMPTZ;

ALTER TABLE public.contrato
  DROP CONSTRAINT IF EXISTS contrato_pdf_firmado_tamano_check,
  ADD CONSTRAINT contrato_pdf_firmado_tamano_check
    CHECK (pdf_firmado_tamano_bytes IS NULL OR pdf_firmado_tamano_bytes > 0);
