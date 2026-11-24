-- ============================================================================
-- US-14: Registrar reclamo
-- Catálogo de tipos de reclamo, extensión de reclamo, fotos y bucket de storage
-- ============================================================================

-- 1. Catálogo de tipos de reclamo
CREATE TABLE IF NOT EXISTS public.tipo_reclamo (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion VARCHAR(255)
);

INSERT INTO public.tipo_reclamo (id, nombre, descripcion)
VALUES
    (1, 'pintura', 'Pintura'),
    (2, 'reparacion_inmueble', 'Reparación del inmueble'),
    (3, 'reparacion_artefactos', 'Reparación de artefactos'),
    (4, 'cobros', 'Cobros'),
    (5, 'otro', 'Otro')
ON CONFLICT (id) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    descripcion = EXCLUDED.descripcion;

SELECT setval(
    pg_get_serial_sequence('public.tipo_reclamo', 'id'),
    COALESCE(MAX(id), 1)
) FROM public.tipo_reclamo;

-- 2. Asegurar estados de reclamo requeridos por US-14/US-15
INSERT INTO public.estado_reclamo (id, nombre)
VALUES
    (1, 'pendiente'),
    (2, 'en_proceso'),
    (3, 'resuelto'),
    (4, 'cancelado')
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre;

SELECT setval(
    pg_get_serial_sequence('public.estado_reclamo', 'id'),
    COALESCE(MAX(id), 1)
) FROM public.estado_reclamo;

-- 3. Extender tabla reclamo con locatario, contrato, tipo y auditoría
ALTER TABLE public.reclamo
    ADD COLUMN IF NOT EXISTS id_locatario INTEGER REFERENCES public.usuario(id),
    ADD COLUMN IF NOT EXISTS id_contrato INTEGER REFERENCES public.contrato(id),
    ADD COLUMN IF NOT EXISTS id_tipo_reclamo INTEGER REFERENCES public.tipo_reclamo(id),
    ADD COLUMN IF NOT EXISTS fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT now(),
    ADD COLUMN IF NOT EXISTS fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Constraint de longitud de mensaje (entre 50 y 5000 caracteres, criterio US-14)
ALTER TABLE public.reclamo
    DROP CONSTRAINT IF EXISTS chk_reclamo_descripcion_longitud;

ALTER TABLE public.reclamo
    ADD CONSTRAINT chk_reclamo_descripcion_longitud
    CHECK (char_length(trim(descripcion)) >= 50 AND char_length(trim(descripcion)) <= 5000);

CREATE INDEX IF NOT EXISTS idx_reclamo_locatario ON public.reclamo(id_locatario);
CREATE INDEX IF NOT EXISTS idx_reclamo_contrato ON public.reclamo(id_contrato);
CREATE INDEX IF NOT EXISTS idx_reclamo_tipo ON public.reclamo(id_tipo_reclamo);

-- 4. Tabla de fotos asociadas al reclamo
CREATE TABLE IF NOT EXISTS public.foto_reclamo (
    id SERIAL PRIMARY KEY,
    id_reclamo INTEGER NOT NULL REFERENCES public.reclamo(id) ON DELETE CASCADE,
    url VARCHAR NOT NULL,
    peso_kb INTEGER NOT NULL CHECK (peso_kb > 0 AND peso_kb <= 350),
    formato VARCHAR NOT NULL CHECK (formato IN ('jpg', 'jpeg', 'png', 'image/jpeg', 'image/png')),
    orden INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_foto_reclamo_reclamo ON public.foto_reclamo(id_reclamo);

-- 5. Bucket de storage "fotos-reclamos" y políticas RLS
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'fotos-reclamos',
    'fotos-reclamos',
    true,
    358400,
    ARRAY['image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "subir fotos reclamos propias" ON storage.objects;
CREATE POLICY "subir fotos reclamos propias"
  ON storage.objects
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (bucket_id = 'fotos-reclamos'::text) AND 
    ((storage.foldername(name))[1] = (auth.uid())::text)
  );

DROP POLICY IF EXISTS "borrar fotos reclamos propias" ON storage.objects;
CREATE POLICY "borrar fotos reclamos propias"
  ON storage.objects
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (
    (bucket_id = 'fotos-reclamos'::text) AND 
    ((storage.foldername(name))[1] = (auth.uid())::text)
  );
