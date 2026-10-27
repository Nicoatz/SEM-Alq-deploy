-- Persistencia necesaria para la consulta de alquileres del locatario (US-27)
-- y los estados individuales de firma definidos en US-07.

ALTER TABLE public.contrato
  ADD COLUMN IF NOT EXISTS dias_para_vencimiento SMALLINT,
  ADD COLUMN IF NOT EXISTS pdf_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS pdf_sha256 CHAR(64);

ALTER TABLE public.contrato_x_usuario
  ADD COLUMN IF NOT EXISTS fecha_conformidad TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hash_documento_conforme CHAR(64),
  ADD COLUMN IF NOT EXISTS estado_firma VARCHAR(20),
  ADD COLUMN IF NOT EXISTS fecha_firma TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fecha_rechazo TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hash_documento_firmado CHAR(64),
  ADD COLUMN IF NOT EXISTS ip_firma INET,
  ADD COLUMN IF NOT EXISTS motivo_rechazo VARCHAR(300);

-- Las relaciones existentes no contienen evidencia para inferir si hubo firma.
-- Se distinguen explícitamente de las nuevas relaciones, que sí empiezan pendientes.
UPDATE public.contrato_x_usuario
SET estado_firma = 'desconocido'
WHERE estado_firma IS NULL;

ALTER TABLE public.contrato_x_usuario
  ALTER COLUMN estado_firma SET DEFAULT 'pendiente',
  ALTER COLUMN estado_firma SET NOT NULL;

-- No se puede elegir automáticamente entre personas distintas asociadas como locatario.
DO $$
BEGIN
  IF EXISTS (
    SELECT id_contrato
    FROM public.contrato_x_usuario
    WHERE tipo_firmante = 2
    GROUP BY id_contrato
    HAVING COUNT(DISTINCT id_usuario) > 1
  ) THEN
    RAISE EXCEPTION
      'Hay contratos con más de un locatario principal; resolver esas relaciones antes de migrar.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.contrato_x_usuario duplicate
    JOIN public.contrato_x_usuario keeper
      ON keeper.id_contrato = duplicate.id_contrato
      AND keeper.id_usuario = duplicate.id_usuario
      AND keeper.tipo_firmante = duplicate.tipo_firmante
      AND keeper.id < duplicate.id
    WHERE duplicate.tipo_firmante = 2
      AND (
        duplicate.fecha_conformidad IS NOT NULL
        OR duplicate.hash_documento_conforme IS NOT NULL
        OR duplicate.fecha_firma IS NOT NULL
        OR duplicate.fecha_rechazo IS NOT NULL
        OR duplicate.hash_documento_firmado IS NOT NULL
        OR duplicate.ip_firma IS NOT NULL
        OR duplicate.motivo_rechazo IS NOT NULL
        OR duplicate.estado_firma NOT IN ('desconocido', 'pendiente')
      )
  ) THEN
    RAISE EXCEPTION
      'Hay relaciones duplicadas de locatario con datos de firma; consolidarlas manualmente antes de migrar.';
  END IF;
END;
$$;

-- Consolidar duplicados exactos sin evidencia de firma; conservar el ID menor.
UPDATE public.contrato_x_usuario keeper
SET estado_firma = 'pendiente'
WHERE keeper.tipo_firmante = 2
  AND keeper.estado_firma = 'desconocido'
  AND EXISTS (
    SELECT 1
    FROM public.contrato_x_usuario duplicate
    WHERE duplicate.id_contrato = keeper.id_contrato
      AND duplicate.id_usuario = keeper.id_usuario
      AND duplicate.tipo_firmante = keeper.tipo_firmante
      AND duplicate.id > keeper.id
      AND duplicate.estado_firma = 'pendiente'
  );

DELETE FROM public.contrato_x_usuario duplicate
USING public.contrato_x_usuario keeper
WHERE duplicate.tipo_firmante = 2
  AND keeper.tipo_firmante = duplicate.tipo_firmante
  AND keeper.id_contrato = duplicate.id_contrato
  AND keeper.id_usuario = duplicate.id_usuario
  AND keeper.id < duplicate.id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_contrato_un_locatario_principal
  ON public.contrato_x_usuario (id_contrato)
  WHERE tipo_firmante = 2;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contrato_dias_para_vencimiento_check'
  ) THEN
    ALTER TABLE public.contrato
      ADD CONSTRAINT contrato_dias_para_vencimiento_check
      CHECK (dias_para_vencimiento IS NULL OR dias_para_vencimiento > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contrato_pdf_sha256_check'
  ) THEN
    ALTER TABLE public.contrato
      ADD CONSTRAINT contrato_pdf_sha256_check
      CHECK (pdf_sha256 IS NULL OR pdf_sha256 ~ '^[0-9a-fA-F]{64}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contrato_x_usuario_estado_firma_check'
  ) THEN
    ALTER TABLE public.contrato_x_usuario
      ADD CONSTRAINT contrato_x_usuario_estado_firma_check
      CHECK (estado_firma IN ('pendiente', 'firmado', 'rechazado', 'desconocido'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contrato_x_usuario_conformidad_hash_check'
  ) THEN
    ALTER TABLE public.contrato_x_usuario
      ADD CONSTRAINT contrato_x_usuario_conformidad_hash_check
      CHECK (
        (fecha_conformidad IS NULL AND hash_documento_conforme IS NULL)
        OR (
          fecha_conformidad IS NOT NULL
          AND hash_documento_conforme ~ '^[0-9a-fA-F]{64}$'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contrato_x_usuario_firma_hash_check'
  ) THEN
    ALTER TABLE public.contrato_x_usuario
      ADD CONSTRAINT contrato_x_usuario_firma_hash_check
      CHECK (hash_documento_firmado IS NULL OR hash_documento_firmado ~ '^[0-9a-fA-F]{64}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contrato_x_usuario_estado_firma_datos_check'
  ) THEN
    ALTER TABLE public.contrato_x_usuario
      ADD CONSTRAINT contrato_x_usuario_estado_firma_datos_check
      CHECK (
        (estado_firma = 'firmado'
          AND fecha_firma IS NOT NULL
          AND hash_documento_firmado IS NOT NULL
          AND ip_firma IS NOT NULL)
        OR (estado_firma = 'pendiente'
          AND fecha_firma IS NULL
          AND hash_documento_firmado IS NULL
          AND ip_firma IS NULL)
        OR (estado_firma = 'rechazado'
          AND fecha_rechazo IS NOT NULL
          AND fecha_firma IS NULL
          AND hash_documento_firmado IS NULL
          AND ip_firma IS NULL)
        OR estado_firma = 'desconocido'
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contrato_x_usuario_motivo_rechazo_check'
  ) THEN
    ALTER TABLE public.contrato_x_usuario
      ADD CONSTRAINT contrato_x_usuario_motivo_rechazo_check
      CHECK (motivo_rechazo IS NULL OR char_length(motivo_rechazo) <= 300);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_contrato_x_usuario_locatario
  ON public.contrato_x_usuario (id_usuario, tipo_firmante, id_contrato);

CREATE TABLE IF NOT EXISTS public.ajuste_contrato (
  id BIGSERIAL PRIMARY KEY,
  id_contrato INTEGER NOT NULL REFERENCES public.contrato(id) ON DELETE CASCADE,
  fecha_efectiva DATE NOT NULL,
  monto_anterior NUMERIC(12, 2) NOT NULL CHECK (monto_anterior > 0),
  monto_nuevo NUMERIC(12, 2) NOT NULL CHECK (monto_nuevo > 0),
  indice_aplicado INTEGER REFERENCES public.tipo_indice(id),
  porcentaje_aplicado NUMERIC(8, 4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ajuste_contrato_fecha_unica UNIQUE (id_contrato, fecha_efectiva)
);

CREATE INDEX IF NOT EXISTS idx_ajuste_contrato_fecha
  ON public.ajuste_contrato (id_contrato, fecha_efectiva DESC, id DESC);

-- La conformidad es irreversible: una vez registrada, no puede borrarse ni cambiar
-- a otra versión del documento. Las cancelaciones de contratos deben bloquearse aparte.
CREATE OR REPLACE FUNCTION public.impedir_cambio_conformidad_contrato()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.fecha_conformidad IS NOT NULL AND (
    NEW.fecha_conformidad IS DISTINCT FROM OLD.fecha_conformidad
    OR NEW.hash_documento_conforme IS DISTINCT FROM OLD.hash_documento_conforme
  ) THEN
    RAISE EXCEPTION 'La conformidad registrada no se puede modificar ni eliminar.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_impedir_cambio_conformidad_contrato
  ON public.contrato_x_usuario;

CREATE TRIGGER trg_impedir_cambio_conformidad_contrato
BEFORE UPDATE ON public.contrato_x_usuario
FOR EACH ROW
EXECUTE FUNCTION public.impedir_cambio_conformidad_contrato();

CREATE OR REPLACE FUNCTION public.impedir_eliminar_conformidad_contrato()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.fecha_conformidad IS NOT NULL THEN
    RAISE EXCEPTION 'No se puede eliminar una conformidad registrada.';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_impedir_eliminar_conformidad_contrato
  ON public.contrato_x_usuario;

CREATE TRIGGER trg_impedir_eliminar_conformidad_contrato
BEFORE DELETE ON public.contrato_x_usuario
FOR EACH ROW
EXECUTE FUNCTION public.impedir_eliminar_conformidad_contrato();

CREATE OR REPLACE FUNCTION public.impedir_edicion_contrato_conforme()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.contrato_x_usuario
    WHERE id_contrato = OLD.id
      AND fecha_conformidad IS NOT NULL
  ) AND (
    NEW.monto_alquiler IS DISTINCT FROM OLD.monto_alquiler
    OR NEW.expensas IS DISTINCT FROM OLD.expensas
    OR NEW.indice_aumento IS DISTINCT FROM OLD.indice_aumento
    OR NEW.frecuencia_ajuste IS DISTINCT FROM OLD.frecuencia_ajuste
    OR NEW.duracion_meses IS DISTINCT FROM OLD.duracion_meses
    OR NEW.deposito IS DISTINCT FROM OLD.deposito
    OR NEW.fecha_inicio_contrato IS DISTINCT FROM OLD.fecha_inicio_contrato
    OR NEW.fecha_fin_contrato IS DISTINCT FROM OLD.fecha_fin_contrato
    OR NEW.dias_para_vencimiento IS DISTINCT FROM OLD.dias_para_vencimiento
    OR NEW.pdf_storage_path IS DISTINCT FROM OLD.pdf_storage_path
    OR NEW.pdf_sha256 IS DISTINCT FROM OLD.pdf_sha256
  ) THEN
    RAISE EXCEPTION 'No se puede modificar el contrato después de una conformidad.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_impedir_edicion_contrato_conforme ON public.contrato;

CREATE TRIGGER trg_impedir_edicion_contrato_conforme
BEFORE UPDATE ON public.contrato
FOR EACH ROW
EXECUTE FUNCTION public.impedir_edicion_contrato_conforme();

-- El PDF es privado. La API entrega una URL firmada solo después de autorizar al locatario.
INSERT INTO storage.buckets (id, name, public)
VALUES ('contratos-pdf', 'contratos-pdf', FALSE)
ON CONFLICT (id) DO UPDATE SET public = FALSE;