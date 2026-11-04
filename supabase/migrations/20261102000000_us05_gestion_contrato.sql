-- US-05 · Registrar contrato de alquiler (esquema)
--
-- Modelo (ver docs/gestion_contrato.md): cada inmueble tiene DOS tipos de fila en `contrato`:
--   · la OFERTA (estado 1, "disponible"): ficha comercial de la publicación. Una por inmueble.
--   · el CONTRATO EN CURSO (estados 5 borrador, 4 pendiente de firma, 2 vigente): lo que se
--     negocia y se firma. Uno por inmueble a la vez. Los finalizados (3) quedan de historial.
-- La publicación siempre lee la oferta, así el precio público no cambia mientras se negocia.

-- ─── 1. Estado "borrador" ───
INSERT INTO public.estado_contrato (id, descripcion, valor)
VALUES (5, 'borrador', TRUE)
ON CONFLICT (id) DO UPDATE
SET descripcion = EXCLUDED.descripcion,
    valor = EXCLUDED.valor;

SELECT setval(
  pg_get_serial_sequence('public.estado_contrato', 'id'),
  (SELECT MAX(id) FROM public.estado_contrato)
);

-- ─── 2. Más de una fila por inmueble ───
-- La restricción UNIQUE(id_inmueble) impedía tener oferta y contrato en curso a la vez.
-- Se reemplaza por los índices parciales de la sección 5. El índice común
-- idx_contrato_inmueble se conserva para las búsquedas.
ALTER TABLE public.contrato
  DROP CONSTRAINT IF EXISTS contrato_id_inmueble_key;

-- ─── 3. Columnas nuevas de contrato ───
ALTER TABLE public.contrato
  ADD COLUMN IF NOT EXISTS codigo VARCHAR(20),
  ADD COLUMN IF NOT EXISTS id_solicitud INTEGER REFERENCES public.solicitud(id),
  ADD COLUMN IF NOT EXISTS ultimo_paso_borrador SMALLINT;

-- Código CT-AAAA-NNNN: se asigna al enviar a firmar (el borrador no tiene código).
ALTER TABLE public.contrato
  DROP CONSTRAINT IF EXISTS contrato_codigo_formato_check,
  ADD CONSTRAINT contrato_codigo_formato_check
    CHECK (codigo IS NULL OR codigo ~ '^CT-[0-9]{4}-[0-9]{4,}$');

-- Una solicitud aceptada origina un solo contrato (US-05).
CREATE UNIQUE INDEX IF NOT EXISTS uq_contrato_codigo
  ON public.contrato (codigo)
  WHERE codigo IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_contrato_solicitud
  ON public.contrato (id_solicitud)
  WHERE id_solicitud IS NOT NULL;

-- Último paso del alta (1 a 4) para retomar el borrador donde se dejó.
ALTER TABLE public.contrato
  DROP CONSTRAINT IF EXISTS contrato_ultimo_paso_borrador_check,
  ADD CONSTRAINT contrato_ultimo_paso_borrador_check
    CHECK (ultimo_paso_borrador IS NULL OR ultimo_paso_borrador BETWEEN 1 AND 4);

-- dias_para_vencimiento (US-27) es el día del mes en que vence el pago. La US-05 lo acota a
-- 1..28. NOTA: el nombre es engañoso, pero renombrarlo obligaría a tocar el código de US-27.
ALTER TABLE public.contrato
  DROP CONSTRAINT IF EXISTS contrato_dias_para_vencimiento_check,
  ADD CONSTRAINT contrato_dias_para_vencimiento_check
    CHECK (dias_para_vencimiento IS NULL OR dias_para_vencimiento BETWEEN 1 AND 28);

-- ─── 4. Datos existentes: crear la oferta de los inmuebles que no la tienen ───
-- Hasta ahora había una sola fila por inmueble, que hacía de oferta y de contrato a la vez. Los
-- inmuebles cuya fila es vigente, pendiente de firma o finalizada necesitan su oferta propia;
-- sin ella desaparecerían de la publicación. La fila existente pasa a ser el contrato en curso.
-- El monto de la oferta es el precio publicado; el resto de las condiciones se copia de la fila.
INSERT INTO public.contrato (
  id_inmueble, monto_alquiler, expensas, indice_aumento, frecuencia_ajuste,
  duracion_meses, deposito, interes_por_dia, dias_gracia, estado, activo
)
SELECT c.id_inmueble, i.precio_publicado, c.expensas, c.indice_aumento, c.frecuencia_ajuste,
       c.duracion_meses, c.deposito, c.interes_por_dia, c.dias_gracia, 1, c.activo
FROM public.contrato c
JOIN public.inmueble i ON i.id = c.id_inmueble
WHERE c.estado IS DISTINCT FROM 1
  AND NOT EXISTS (
    SELECT 1 FROM public.contrato o
    WHERE o.id_inmueble = c.id_inmueble AND o.estado = 1
  );

-- Los medios de pago de la oferta son los del contrato del que se copió.
INSERT INTO public.medio_pago_x_contrato (id_contrato, id_medio_pago)
SELECT oferta.id, mp.id_medio_pago
FROM public.contrato oferta
JOIN public.contrato origen
  ON origen.id_inmueble = oferta.id_inmueble
  AND origen.estado IS DISTINCT FROM 1
JOIN public.medio_pago_x_contrato mp ON mp.id_contrato = origen.id
WHERE oferta.estado = 1
ON CONFLICT (id_contrato, id_medio_pago) DO NOTHING;

-- ─── 5. Reglas de unicidad por inmueble ───
CREATE UNIQUE INDEX IF NOT EXISTS uq_contrato_una_oferta_por_inmueble
  ON public.contrato (id_inmueble)
  WHERE estado = 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_contrato_uno_en_curso_por_inmueble
  ON public.contrato (id_inmueble)
  WHERE estado IN (2, 4, 5);

-- ─── 6. Cláusulas del contrato ───
-- Se guardan por contrato porque el locador edita las suyas y agrega otras: el texto firmado
-- (y su PDF) sale de acá. Las fijas no se editan; las editables y propias tienen tope de 1.000
-- caracteres (US-05, paso 3).
CREATE TABLE IF NOT EXISTS public.clausula_contrato (
  id SERIAL PRIMARY KEY,
  id_contrato INTEGER NOT NULL REFERENCES public.contrato(id) ON DELETE CASCADE,
  orden SMALLINT NOT NULL CHECK (orden > 0),
  titulo VARCHAR(150) NOT NULL,
  texto TEXT NOT NULL,
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('fija', 'editable', 'propia')),
  editada BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT clausula_contrato_texto_max_check
    CHECK (tipo = 'fija' OR char_length(texto) <= 1000)
);

CREATE INDEX IF NOT EXISTS idx_clausula_contrato
  ON public.clausula_contrato (id_contrato, orden);

-- ─── 7. Garantes ───
-- No son usuarios de la plataforma, pero firman. Firman con un enlace que el locador comparte
-- por su cuenta (no hay correo integrado): se guarda solo el hash del token, nunca el token.
-- Las columnas de firma replican las de contrato_x_usuario (US-27).
CREATE TABLE IF NOT EXISTS public.garante (
  id SERIAL PRIMARY KEY,
  id_contrato INTEGER NOT NULL REFERENCES public.contrato(id) ON DELETE CASCADE,
  nombre VARCHAR(100) NOT NULL,
  apellido VARCHAR(100) NOT NULL,
  dni VARCHAR(8) NOT NULL CHECK (dni ~ '^[0-9]{7,8}$'),
  email VARCHAR(255) NOT NULL,
  estado_firma VARCHAR(20) NOT NULL DEFAULT 'pendiente'
    CHECK (estado_firma IN ('pendiente', 'firmado', 'rechazado')),
  fecha_firma TIMESTAMPTZ,
  fecha_rechazo TIMESTAMPTZ,
  hash_documento_firmado CHAR(64),
  ip_firma INET,
  motivo_rechazo VARCHAR(300),
  token_firma_hash CHAR(64),
  token_vence_en TIMESTAMPTZ,
  CONSTRAINT garante_hash_documento_check
    CHECK (hash_documento_firmado IS NULL OR hash_documento_firmado ~ '^[0-9a-fA-F]{64}$'),
  CONSTRAINT garante_token_hash_check
    CHECK (token_firma_hash IS NULL OR token_firma_hash ~ '^[0-9a-fA-F]{64}$'),
  CONSTRAINT garante_estado_firma_datos_check
    CHECK (
      (estado_firma = 'firmado'
        AND fecha_firma IS NOT NULL
        AND hash_documento_firmado IS NOT NULL
        AND ip_firma IS NOT NULL)
      OR (estado_firma = 'rechazado' AND fecha_rechazo IS NOT NULL)
      OR (estado_firma = 'pendiente'
        AND fecha_firma IS NULL
        AND fecha_rechazo IS NULL)
    ),
  CONSTRAINT garante_motivo_rechazo_check
    CHECK (motivo_rechazo IS NULL OR char_length(motivo_rechazo) <= 300)
);

-- No se repiten DNI ni correo entre los garantes de un mismo contrato (US-05, paso 1).
CREATE UNIQUE INDEX IF NOT EXISTS uq_garante_contrato_dni
  ON public.garante (id_contrato, dni);

CREATE UNIQUE INDEX IF NOT EXISTS uq_garante_contrato_email
  ON public.garante (id_contrato, lower(email));

-- El enlace de firma se busca por el hash de su token.
CREATE UNIQUE INDEX IF NOT EXISTS uq_garante_token_firma_hash
  ON public.garante (token_firma_hash)
  WHERE token_firma_hash IS NOT NULL;

-- Todo dato pasa por apps/api con la clave de servicio: RLS activo y sin políticas.
ALTER TABLE public.clausula_contrato ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garante ENABLE ROW LEVEL SECURITY;

-- ─── 8. Baja lógica de inmueble (US-04) con oferta y contrato en curso ───
-- Cambio respecto de 20261009000000: antes finalizaba todos los contratos del inmueble sin
-- mirar su estado. Ahora hay dos filas, y un contrato pendiente de firma tiene firmas en curso
-- (incluidos garantes con enlace emitido): se bloquea la baja hasta resolverlo. La oferta y un
-- eventual borrador sí se finalizan junto con el inmueble.
CREATE OR REPLACE FUNCTION public.eliminar_inmueble_logico(
    p_id_inmueble INTEGER,
    p_id_locador INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_inmueble public.inmueble%ROWTYPE;
BEGIN
    -- Buscar y bloquear el inmueble durante la operación.
    SELECT *
    INTO v_inmueble
    FROM public.inmueble
    WHERE id = p_id_inmueble
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'statusCode', 404,
            'message', 'Inmueble no encontrado.'
        );
    END IF;

    -- Verificar que pertenezca al locador autenticado.
    IF v_inmueble.id_locador <> p_id_locador THEN
        RETURN jsonb_build_object(
            'success', false,
            'statusCode', 403,
            'message', 'No tenés permiso para eliminar este inmueble.'
        );
    END IF;

    -- Evitar eliminar un inmueble que ya está inactivo.
    IF NOT v_inmueble.activo THEN
        RETURN jsonb_build_object(
            'success', false,
            'statusCode', 404,
            'message', 'Inmueble no encontrado.'
        );
    END IF;

    -- Solo se permite eliminar propiedades publicadas o pausadas.
    IF v_inmueble.estado_alquiler IN ('alquilado', 'publicado/alquilado') THEN
        RETURN jsonb_build_object(
            'success', false,
            'statusCode', 409,
            'message', 'No se puede eliminar un inmueble que está alquilado.'
        );
    END IF;

    IF v_inmueble.estado_alquiler NOT IN ('publicado', 'pausado') THEN
        RETURN jsonb_build_object(
            'success', false,
            'statusCode', 409,
            'message', 'El estado del inmueble no permite eliminarlo.'
        );
    END IF;

    -- Un contrato pendiente de firma tiene firmas en curso: resolverlo antes de eliminar.
    IF EXISTS (
        SELECT 1
        FROM public.contrato
        WHERE id_inmueble = p_id_inmueble
          AND estado = 4
          AND activo = TRUE
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'statusCode', 409,
            'message', 'No se puede eliminar un inmueble con un contrato pendiente de firma.'
        );
    END IF;

    -- Finalizar e inactivar los contratos asociados (la oferta y un eventual borrador).
    UPDATE public.contrato
    SET estado = 3,
        activo = false
    WHERE id_inmueble = p_id_inmueble;

    -- Inactivar el inmueble sin eliminarlo físicamente.
    UPDATE public.inmueble
    SET activo = false
    WHERE id = p_id_inmueble;

    RETURN jsonb_build_object(
        'success', true,
        'statusCode', 200,
        'message', 'Inmueble eliminado correctamente.'
    );
END;
$$;

-- Que PostgREST (la API de Supabase) recargue el esquema: sin esto sigue creyendo que
-- contrato→inmueble es 1 a 1 hasta que se reinicie.
NOTIFY pgrst, 'reload schema';
