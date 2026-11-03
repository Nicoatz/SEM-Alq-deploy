-- US-08 · Registrar cobro manual
-- Los períodos se identifican por mes calendario y se generan al activar el contrato.
-- El cobro de US-08 cubre el alquiler base más mora lineal; las expensas no se cobran aquí.

CREATE TABLE IF NOT EXISTS public.periodo_cobro (
  id BIGSERIAL PRIMARY KEY,
  id_contrato INTEGER NOT NULL REFERENCES public.contrato(id) ON DELETE RESTRICT,
  periodo CHAR(7) NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  fecha_disponible_monto DATE NOT NULL,
  fecha_vencimiento DATE NOT NULL,
  monto_base_alquiler NUMERIC(12,2) NOT NULL CHECK (monto_base_alquiler > 0),
  expensas_snapshot NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (expensas_snapshot >= 0),
  interes_diario_pct NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (interes_diario_pct >= 0),
  dias_gracia SMALLINT NOT NULL DEFAULT 0 CHECK (dias_gracia >= 0),
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'vencido', 'pagado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id_contrato, periodo),
  CHECK (periodo ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  CHECK (fecha_inicio = make_date(left(periodo, 4)::INTEGER, right(periodo, 2)::INTEGER, 1)),
  CHECK (fecha_fin = (date_trunc('month', fecha_inicio::TIMESTAMP) + INTERVAL '1 month - 1 day')::DATE)
);

CREATE INDEX IF NOT EXISTS idx_periodo_cobro_contrato_periodo
  ON public.periodo_cobro (id_contrato, fecha_inicio DESC);
CREATE INDEX IF NOT EXISTS idx_periodo_cobro_estado_vencimiento
  ON public.periodo_cobro (estado, fecha_vencimiento);

CREATE TABLE IF NOT EXISTS public.contador_comprobante_cobro (
  anio INTEGER PRIMARY KEY,
  ultimo_numero INTEGER NOT NULL CHECK (ultimo_numero >= 0)
);

CREATE TABLE IF NOT EXISTS public.cobro (
  id BIGSERIAL PRIMARY KEY,
  id_periodo BIGINT NOT NULL REFERENCES public.periodo_cobro(id) ON DELETE RESTRICT,
  id_usuario_registro INTEGER NOT NULL REFERENCES public.usuario(id) ON DELETE RESTRICT,
  monto NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  fecha_cobro DATE NOT NULL,
  medio VARCHAR(30) NOT NULL
    CHECK (medio IN ('transferencia', 'efectivo', 'cheque', 'mercadopago_externo', 'otro')),
  nota VARCHAR(200),
  comprobante_storage_path TEXT,
  numero_comprobante VARCHAR(20) NOT NULL UNIQUE,
  fecha_emision TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT cobro_unico_por_periodo UNIQUE (id_periodo),
  CONSTRAINT cobro_otro_nota_check
    CHECK (medio <> 'otro' OR char_length(trim(nota)) > 0),
  CONSTRAINT cobro_numero_formato_check
    CHECK (numero_comprobante ~ '^RC-[0-9]{4}-[0-9]{4,}$')
);

CREATE INDEX IF NOT EXISTS idx_cobro_usuario_registro
  ON public.cobro (id_usuario_registro, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cobro_periodo
  ON public.cobro (id_periodo);

-- Impide modificar condiciones de un contrato vigente que ya tiene locador y locatario.
-- El cambio de estado a finalizado se permite para cerrar el ciclo de vida.
CREATE OR REPLACE FUNCTION public.impedir_edicion_contrato_vigente()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.estado = 2 AND EXISTS (
    SELECT 1
    FROM public.contrato_x_usuario
    WHERE id_contrato = OLD.id
      AND tipo_firmante IN (1, 2)
    GROUP BY id_contrato
    HAVING COUNT(DISTINCT tipo_firmante) = 2
  ) AND (
    NEW.id_inmueble IS DISTINCT FROM OLD.id_inmueble
    OR NEW.monto_alquiler IS DISTINCT FROM OLD.monto_alquiler
    OR NEW.expensas IS DISTINCT FROM OLD.expensas
    OR NEW.indice_aumento IS DISTINCT FROM OLD.indice_aumento
    OR NEW.frecuencia_ajuste IS DISTINCT FROM OLD.frecuencia_ajuste
    OR NEW.duracion_meses IS DISTINCT FROM OLD.duracion_meses
    OR NEW.deposito IS DISTINCT FROM OLD.deposito
    OR NEW.interes_por_dia IS DISTINCT FROM OLD.interes_por_dia
    OR NEW.dias_gracia IS DISTINCT FROM OLD.dias_gracia
    OR NEW.dias_para_vencimiento IS DISTINCT FROM OLD.dias_para_vencimiento
    OR NEW.fecha_inicio_contrato IS DISTINCT FROM OLD.fecha_inicio_contrato
    OR NEW.fecha_fin_contrato IS DISTINCT FROM OLD.fecha_fin_contrato
    OR NEW.id_solicitud IS DISTINCT FROM OLD.id_solicitud
  ) THEN
    RAISE EXCEPTION 'No se puede modificar un contrato vigente.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_impedir_edicion_contrato_vigente ON public.contrato;
CREATE TRIGGER trg_impedir_edicion_contrato_vigente
BEFORE UPDATE ON public.contrato
FOR EACH ROW
EXECUTE FUNCTION public.impedir_edicion_contrato_vigente();

-- Número correlativo anual sin huecos para el comprobante que US-10 renderiza bajo demanda.
CREATE OR REPLACE FUNCTION public.siguiente_numero_comprobante_cobro(p_anio INTEGER)
RETURNS VARCHAR
LANGUAGE plpgsql
AS $$
DECLARE
  v_numero INTEGER;
BEGIN
  INSERT INTO public.contador_comprobante_cobro (anio, ultimo_numero)
  VALUES (p_anio, 1)
  ON CONFLICT (anio) DO UPDATE
    SET ultimo_numero = contador_comprobante_cobro.ultimo_numero + 1
  RETURNING ultimo_numero INTO v_numero;

  RETURN format('RC-%s-%s', p_anio, lpad(v_numero::TEXT, 4, '0'));
END;
$$;

-- Genera todos los meses calendario del contrato vigente. Es idempotente para permitir
-- que la activación pueda reintentarse sin duplicar períodos.
CREATE OR REPLACE FUNCTION public.generar_periodos_contrato(p_id_contrato INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_contrato public.contrato%ROWTYPE;
  v_mes DATE;
  v_ultimo_mes DATE;
  v_periodo TEXT;
  v_fecha_vencimiento DATE;
  v_insertados INTEGER := 0;
BEGIN
  SELECT * INTO v_contrato
  FROM public.contrato
  WHERE id = p_id_contrato
  FOR UPDATE;

  IF NOT FOUND OR v_contrato.estado <> 2 OR NOT v_contrato.activo THEN
    RAISE EXCEPTION 'Solo se pueden generar períodos de un contrato vigente.';
  END IF;

  IF v_contrato.fecha_inicio_contrato IS NULL OR v_contrato.fecha_fin_contrato IS NULL THEN
    RAISE EXCEPTION 'El contrato vigente debe tener fechas de inicio y fin.';
  END IF;

  v_mes := date_trunc('month', v_contrato.fecha_inicio_contrato)::DATE;
  v_ultimo_mes := date_trunc('month', v_contrato.fecha_fin_contrato)::DATE;

  WHILE v_mes <= v_ultimo_mes LOOP
    v_periodo := to_char(v_mes, 'YYYY-MM');
    v_fecha_vencimiento := make_date(
      extract(YEAR FROM v_mes)::INTEGER,
      extract(MONTH FROM v_mes)::INTEGER,
      LEAST(
        COALESCE(v_contrato.dias_para_vencimiento, 1),
        extract(DAY FROM (v_mes + INTERVAL '1 month - 1 day'))::INTEGER
      )
    );

    INSERT INTO public.periodo_cobro (
      id_contrato,
      periodo,
      fecha_inicio,
      fecha_fin,
      fecha_disponible_monto,
      fecha_vencimiento,
      monto_base_alquiler,
      expensas_snapshot,
      interes_diario_pct,
      dias_gracia
    )
    VALUES (
      p_id_contrato,
      v_periodo,
      v_mes,
      (v_mes + INTERVAL '1 month - 1 day')::DATE,
      v_mes,
      v_fecha_vencimiento,
      v_contrato.monto_alquiler,
      v_contrato.expensas,
      COALESCE(v_contrato.interes_por_dia, 0),
      COALESCE(v_contrato.dias_gracia, 0)
    )
    ON CONFLICT (id_contrato, periodo) DO NOTHING;

    IF FOUND THEN
      v_insertados := v_insertados + 1;
    END IF;
    v_mes := (v_mes + INTERVAL '1 month')::DATE;
  END LOOP;

  RETURN v_insertados;
END;
$$;

CREATE OR REPLACE FUNCTION public.generar_periodos_al_activar_contrato()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.estado = 2 AND OLD.estado IS DISTINCT FROM 2 THEN
    PERFORM public.generar_periodos_contrato(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generar_periodos_al_activar_contrato ON public.contrato;
CREATE TRIGGER trg_generar_periodos_al_activar_contrato
AFTER UPDATE OF estado ON public.contrato
FOR EACH ROW
EXECUTE FUNCTION public.generar_periodos_al_activar_contrato();

-- Registra el saldo completo del período y lo marca como pagado en una transacción.
CREATE OR REPLACE FUNCTION public.registrar_cobro_manual(
  p_id_periodo BIGINT,
  p_id_locador INTEGER,
  p_fecha_cobro DATE,
  p_medio VARCHAR,
  p_nota VARCHAR DEFAULT NULL,
  p_comprobante_storage_path TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_periodo public.periodo_cobro%ROWTYPE;
  v_contrato public.contrato%ROWTYPE;
  v_id_locador INTEGER;
  v_dias_atraso INTEGER;
  v_dias_interes INTEGER;
  v_intereses NUMERIC(12,2);
  v_total NUMERIC(12,2);
  v_numero VARCHAR(20);
  v_cobro_id BIGINT;
BEGIN
  SELECT pc.* INTO v_periodo
  FROM public.periodo_cobro pc
  WHERE pc.id = p_id_periodo
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El período no existe.' USING ERRCODE = 'P0002';
  END IF;

  SELECT c.* INTO v_contrato
  FROM public.contrato c
  JOIN public.inmueble i ON i.id = c.id_inmueble
  WHERE c.id = v_periodo.id_contrato
  FOR UPDATE OF c;

  SELECT i.id_locador INTO v_id_locador
  FROM public.inmueble i
  WHERE i.id = v_contrato.id_inmueble;

  IF v_id_locador IS DISTINCT FROM p_id_locador THEN
    RAISE EXCEPTION 'El período no pertenece al locador.' USING ERRCODE = '42501';
  END IF;
  IF v_contrato.estado <> 2 OR NOT v_contrato.activo THEN
    RAISE EXCEPTION 'Solo se pueden registrar cobros de contratos vigentes.' USING ERRCODE = 'P0001';
  END IF;
  IF v_periodo.estado NOT IN ('pendiente', 'vencido') THEN
    RAISE EXCEPTION 'El período no está disponible para registrar un cobro.' USING ERRCODE = 'P0001';
  END IF;
  IF v_periodo.fecha_inicio > CURRENT_DATE THEN
    RAISE EXCEPTION 'No se pueden registrar cobros de períodos futuros.' USING ERRCODE = 'P0001';
  END IF;
  IF p_fecha_cobro > CURRENT_DATE OR p_fecha_cobro < v_contrato.fecha_inicio_contrato THEN
    RAISE EXCEPTION 'La fecha del cobro no es válida.' USING ERRCODE = 'P0001';
  END IF;
  IF p_medio NOT IN ('transferencia', 'efectivo', 'cheque', 'mercadopago_externo', 'otro') THEN
    RAISE EXCEPTION 'El medio de cobro no es válido.' USING ERRCODE = 'P0001';
  END IF;
  IF p_medio = 'otro' AND NULLIF(trim(p_nota), '') IS NULL THEN
    RAISE EXCEPTION 'La nota es obligatoria para el medio otro.' USING ERRCODE = 'P0001';
  END IF;
  IF p_nota IS NOT NULL AND char_length(p_nota) > 200 THEN
    RAISE EXCEPTION 'La nota no puede superar los 200 caracteres.' USING ERRCODE = 'P0001';
  END IF;

  v_dias_atraso := GREATEST(0, p_fecha_cobro - v_periodo.fecha_vencimiento);
  v_dias_interes := GREATEST(0, v_dias_atraso - v_periodo.dias_gracia);
  v_intereses := round(v_periodo.monto_base_alquiler * (v_periodo.interes_diario_pct / 100) * v_dias_interes, 2);
  v_total := v_periodo.monto_base_alquiler + v_intereses;
  v_numero := public.siguiente_numero_comprobante_cobro(extract(YEAR FROM p_fecha_cobro)::INTEGER);

  INSERT INTO public.cobro (
    id_periodo,
    id_usuario_registro,
    monto,
    fecha_cobro,
    medio,
    nota,
    comprobante_storage_path,
    numero_comprobante
  )
  VALUES (
    p_id_periodo,
    p_id_locador,
    v_total,
    p_fecha_cobro,
    p_medio,
    NULLIF(trim(p_nota), ''),
    p_comprobante_storage_path,
    v_numero
  )
  RETURNING id INTO v_cobro_id;

  UPDATE public.periodo_cobro
  SET estado = 'pagado'
  WHERE id = p_id_periodo;

  RETURN jsonb_build_object(
    'cobro_id', v_cobro_id,
    'periodo_id', p_id_periodo,
    'monto', v_total,
    'intereses', v_intereses,
    'dias_interes', v_dias_interes,
    'numero_comprobante', v_numero,
    'estado_periodo', 'pagado'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.siguiente_numero_comprobante_cobro(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.generar_periodos_contrato(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.registrar_cobro_manual(BIGINT, INTEGER, DATE, VARCHAR, VARCHAR, TEXT) TO service_role;
REVOKE EXECUTE ON FUNCTION public.siguiente_numero_comprobante_cobro(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generar_periodos_contrato(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.registrar_cobro_manual(BIGINT, INTEGER, DATE, VARCHAR, VARCHAR, TEXT) FROM PUBLIC, anon, authenticated;
