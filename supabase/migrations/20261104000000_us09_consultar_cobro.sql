-- US-09 · Historial append-only de períodos de cobro.
-- Los triggers se ejecutan dentro de las mismas transacciones que generan períodos,
-- registran cobros y cambian el período a pagado en US-08.

CREATE TABLE IF NOT EXISTS public.periodo_cobro_evento (
  id BIGSERIAL PRIMARY KEY,
  id_periodo BIGINT NOT NULL REFERENCES public.periodo_cobro(id) ON DELETE RESTRICT,
  tipo VARCHAR(40) NOT NULL
    CHECK (tipo IN ('periodo_generado', 'cobro_registrado', 'periodo_pagado')),
  id_usuario INTEGER REFERENCES public.usuario(id) ON DELETE RESTRICT,
  fecha_hora TIMESTAMPTZ NOT NULL DEFAULT now(),
  datos JSONB NOT NULL DEFAULT '{}'::JSONB,
  CONSTRAINT periodo_cobro_evento_unico UNIQUE (id_periodo, tipo)
);

ALTER TABLE public.periodo_cobro_evento ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.periodo_cobro_evento TO service_role;

CREATE INDEX IF NOT EXISTS idx_periodo_cobro_evento_periodo_fecha
  ON public.periodo_cobro_evento (id_periodo, fecha_hora DESC, id DESC);

-- Backfill verificable desde los timestamps y cobros existentes.
INSERT INTO public.periodo_cobro_evento (id_periodo, tipo, fecha_hora, datos)
SELECT id, 'periodo_generado', created_at,
       jsonb_build_object('periodo', periodo)
FROM public.periodo_cobro
ON CONFLICT (id_periodo, tipo) DO NOTHING;

INSERT INTO public.periodo_cobro_evento (id_periodo, tipo, id_usuario, fecha_hora, datos)
SELECT id_periodo, 'cobro_registrado', id_usuario_registro, created_at,
       jsonb_build_object(
         'id_cobro', id,
         'numero_comprobante', numero_comprobante,
         'monto', monto,
         'fecha_cobro', fecha_cobro
       )
FROM public.cobro
ON CONFLICT (id_periodo, tipo) DO NOTHING;

INSERT INTO public.periodo_cobro_evento (id_periodo, tipo, id_usuario, fecha_hora, datos)
SELECT periodo.id, 'periodo_pagado', cobro.id_usuario_registro, cobro.created_at,
       jsonb_build_object('id_cobro', cobro.id, 'numero_comprobante', cobro.numero_comprobante)
FROM public.periodo_cobro AS periodo
JOIN public.cobro AS cobro ON cobro.id_periodo = periodo.id
WHERE periodo.estado = 'pagado'
ON CONFLICT (id_periodo, tipo) DO NOTHING;

CREATE OR REPLACE FUNCTION public.registrar_evento_periodo_generado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.periodo_cobro_evento (id_periodo, tipo, fecha_hora, datos)
  VALUES (
    NEW.id,
    'periodo_generado',
    NEW.created_at,
    jsonb_build_object('periodo', NEW.periodo)
  )
  ON CONFLICT (id_periodo, tipo) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_periodo_cobro_evento_generado ON public.periodo_cobro;
CREATE TRIGGER trg_periodo_cobro_evento_generado
AFTER INSERT ON public.periodo_cobro
FOR EACH ROW
EXECUTE FUNCTION public.registrar_evento_periodo_generado();

CREATE OR REPLACE FUNCTION public.registrar_evento_cobro_creado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.periodo_cobro_evento (id_periodo, tipo, id_usuario, fecha_hora, datos)
  VALUES (
    NEW.id_periodo,
    'cobro_registrado',
    NEW.id_usuario_registro,
    NEW.created_at,
    jsonb_build_object(
      'id_cobro', NEW.id,
      'numero_comprobante', NEW.numero_comprobante,
      'monto', NEW.monto,
      'fecha_cobro', NEW.fecha_cobro
    )
  )
  ON CONFLICT (id_periodo, tipo) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cobro_evento_creado ON public.cobro;
CREATE TRIGGER trg_cobro_evento_creado
AFTER INSERT ON public.cobro
FOR EACH ROW
EXECUTE FUNCTION public.registrar_evento_cobro_creado();

CREATE OR REPLACE FUNCTION public.registrar_evento_periodo_pagado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cobro public.cobro%ROWTYPE;
BEGIN
  IF OLD.estado IS DISTINCT FROM NEW.estado AND NEW.estado = 'pagado' THEN
    SELECT * INTO v_cobro
    FROM public.cobro
    WHERE id_periodo = NEW.id
    ORDER BY id DESC
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'No se puede marcar el período como pagado sin un cobro registrado.';
    END IF;

    INSERT INTO public.periodo_cobro_evento (id_periodo, tipo, id_usuario, fecha_hora, datos)
    VALUES (
      NEW.id,
      'periodo_pagado',
      v_cobro.id_usuario_registro,
      v_cobro.created_at,
      jsonb_build_object('id_cobro', v_cobro.id, 'numero_comprobante', v_cobro.numero_comprobante)
    )
    ON CONFLICT (id_periodo, tipo) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_periodo_cobro_evento_pagado ON public.periodo_cobro;
CREATE TRIGGER trg_periodo_cobro_evento_pagado
AFTER UPDATE OF estado ON public.periodo_cobro
FOR EACH ROW
EXECUTE FUNCTION public.registrar_evento_periodo_pagado();

CREATE OR REPLACE FUNCTION public.impedir_modificar_periodo_cobro_evento()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'El historial de períodos de cobro es inmutable.';
END;
$$;

DROP TRIGGER IF EXISTS trg_periodo_cobro_evento_inmutable ON public.periodo_cobro_evento;
CREATE TRIGGER trg_periodo_cobro_evento_inmutable
BEFORE UPDATE OR DELETE ON public.periodo_cobro_evento
FOR EACH ROW
EXECUTE FUNCTION public.impedir_modificar_periodo_cobro_evento();