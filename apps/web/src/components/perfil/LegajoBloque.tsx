'use client'

/**
 * LegajoBloque.tsx — el bloque "Mi legajo" de "Mi perfil".
 *
 * Qué es: situación ocupacional, ingreso mensual declarado y garantías que
 * puede ofrecer, con el aviso de legajo completo o incompleto y qué falta
 * (criterio en `lib/perfil/legajo.ts`).
 * Cubre:
 * - US-20 Consultar usuario: los datos y si el legajo está completo.
 * - US-21 Modificar usuario: el bloque se edita y se guarda solo (Guardar y
 *   Cancelar); situación con las opciones de US-35, ingreso entero mayor a 0
 *   o vacío, varias garantías. Mensaje de éxito o de error en español.
 * De dónde saca los datos: `PerfilUsuario.legajo` (lo pasa `PerfilScreen`);
 * guarda con `perfil.service#actualizarLegajo`.
 * Quién lo usa: `PerfilScreen.tsx`.
 *
 * NOTA (diseño vs. US): el diseño suma documentación (FileDropzone) y otras
 * garantías ("recibo de sueldo", "garante con recibo"). Manda la US: las
 * garantías son las de US-35 y no hay archivos en esta tanda.
 */
import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Checkbox, Form, InputNumber, Select } from 'antd'
import type { GarantiaOfrecida, LegajoUsuario, OcupacionPostulante } from '@rentar/shared-types'
import { DetailList, MoneyAmount } from '@rentar/ui'
import { estadoLegajo, textoFaltantes } from '@/lib/perfil/legajo'
import { GARANTIA_LABEL, GARANTIA_OPTIONS, OCUPACION_LABEL, OCUPACION_OPTIONS } from '@/lib/validation/solicitud.rules'
import { reglasIngresoLegajo } from '@/lib/validation/usuario.rules'
import { actualizarLegajo } from '@/services/perfil.service'
import { ServiceError } from '@/services/shared/errors'
import { BloquePerfil } from './BloquePerfil'
import styles from './BloquesPerfil.module.css'
import { SinCargar } from './SinCargar'

/** Props de {@link LegajoBloque}. */
interface LegajoBloqueProps {
  legajo: LegajoUsuario
  /** En móvil, si arranca abierto (el legajo incompleto va primero y abierto, como en el diseño). */
  defaultOpen?: boolean
  /** El legajo quedó guardado: `PerfilScreen` lo reemplaza. */
  onActualizado: (legajo: LegajoUsuario) => void
  /** Avisa si hay cambios sin guardar (para el aviso de salida, US-21). */
  onCambiosSinGuardar: (hayCambios: boolean) => void
}

/** Los campos del formulario. `ingresos` es `null` si el campo quedó vacío. */
interface ValoresLegajo {
  ocupacion: OcupacionPostulante
  ingresos: number | null
  garantias: GarantiaOfrecida[]
}

/** Legajo → valores del formulario (lo que restaura Cancelar). */
function valoresDe(legajo: LegajoUsuario): ValoresLegajo {
  return { ocupacion: legajo.occupation, ingresos: legajo.monthlyIncome, garantias: legajo.guarantees }
}

/** Valores del formulario → legajo. */
function legajoDe(valores: ValoresLegajo): LegajoUsuario {
  return { occupation: valores.ocupacion, monthlyIncome: valores.ingresos ?? null, guarantees: valores.garantias ?? [] }
}

/** `true` si los dos legajos dicen lo mismo (las garantías, sin importar el orden). */
function mismoLegajo(a: LegajoUsuario, b: LegajoUsuario): boolean {
  return (
    a.occupation === b.occupation &&
    a.monthlyIncome === b.monthlyIncome &&
    a.guarantees.length === b.guarantees.length &&
    a.guarantees.every((garantia) => b.guarantees.includes(garantia))
  )
}

/** "2 de 3": el chip del encabezado del legajo en móvil. */
export function ChipLegajo({ legajo }: { legajo: LegajoUsuario }) {
  const estado = estadoLegajo(legajo)
  return (
    <span className={`${styles.chip} ${estado.completo ? styles.chipComplete : styles.chipIncomplete}`} data-testid="perfil-legajo-chip">
      {estado.completo ? 'Completo' : `${estado.cargados} de ${estado.total}`}
    </span>
  )
}

/** Aviso de legajo completo o incompleto (US-20: "indicar si está completo o incompleto y qué falta"). */
function AvisoLegajo({ legajo }: { legajo: LegajoUsuario }) {
  const estado = estadoLegajo(legajo)
  if (estado.completo) {
    return (
      <div className={`${styles.notice} ${styles.noticeSuccess}`} data-testid="perfil-legajo-estado" data-estado="completo">
        <span>
          <strong>Legajo completo.</strong> Se precarga en cada solicitud que envíes.
        </span>
      </div>
    )
  }
  return (
    <div className={`${styles.notice} ${styles.noticeWarning}`} data-testid="perfil-legajo-estado" data-estado="incompleto">
      <span className={styles.noticeTitle}>Legajo incompleto</span>
      <span data-testid="perfil-legajo-faltantes">{textoFaltantes(estado.faltantes)}</span>
    </div>
  )
}

/** Props de {@link FormularioLegajo}. */
interface FormularioLegajoProps {
  legajo: LegajoUsuario
  onGuardado: (legajo: LegajoUsuario) => void
  onCancelar: () => void
  onCambiosSinGuardar: (hayCambios: boolean) => void
}

/**
 * El formulario de edición del legajo, con su propio `Form.useForm` (se
 * monta al editar y se desmonta al guardar o cancelar, así Cancelar siempre
 * vuelve a lo guardado).
 */
function FormularioLegajo({ legajo, onGuardado, onCancelar, onCambiosSinGuardar }: FormularioLegajoProps) {
  const [form] = Form.useForm<ValoresLegajo>()
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const iniciales = useMemo(() => valoresDe(legajo), [legajo])
  const valores = Form.useWatch([], form) as Partial<ValoresLegajo> | undefined
  const hayCambios = valores !== undefined && !mismoLegajo(legajo, legajoDe({ ...iniciales, ...valores }))

  useEffect(() => {
    onCambiosSinGuardar(hayCambios)
  }, [hayCambios, onCambiosSinGuardar])
  // Al desmontarse (guardó o canceló) ya no quedan cambios pendientes.
  useEffect(() => () => onCambiosSinGuardar(false), [onCambiosSinGuardar])

  // ─── Handlers ───────────────────────────────────────────────────────
  async function guardar(valoresForm: ValoresLegajo): Promise<void> {
    const nuevo = legajoDe(valoresForm)
    if (mismoLegajo(legajo, nuevo)) {
      onCancelar()
      return
    }
    setGuardando(true)
    setError(null)
    try {
      onGuardado(await actualizarLegajo(nuevo))
    } catch (excepcion) {
      setError(excepcion instanceof ServiceError ? excepcion.message : 'No pudimos guardar el legajo. Probá de nuevo.')
      setGuardando(false)
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────
  return (
    <Form<ValoresLegajo> form={form} layout="vertical" initialValues={iniciales} onFinish={guardar} requiredMark={false} disabled={guardando} data-testid="perfil-legajo-form">
      {error && <Alert type="error" showIcon title={error} className={styles.formAlert} data-testid="perfil-legajo-error" />}
      <div className={styles.grid}>
        {/* US-21: mismas opciones que US-35; "Prefiero no decirlo" es el "-". */}
        <Form.Item name="ocupacion" label="Situación ocupacional">
          <Select options={OCUPACION_OPTIONS} data-testid="perfil-legajo-ocupacion-input" />
        </Form.Item>
        {/* US-21: entero mayor a 0, o vacío (acá el 0 no vale: ver `ingresoLegajoValido`). */}
        <Form.Item name="ingresos" label="Ingreso mensual declarado" rules={reglasIngresoLegajo} extra="Dejalo vacío si no querés cargarlo.">
          <InputNumber<number> prefix="$" controls={false} decimalSeparator="," className={styles.fullWidth} data-testid="perfil-legajo-ingresos-input" />
        </Form.Item>
      </div>
      <Form.Item name="garantias" label="Garantías que podés ofrecer">
        <Checkbox.Group>
          {GARANTIA_OPTIONS.map((opcion) => (
            <Checkbox key={opcion.value} value={opcion.value} data-testid={`perfil-legajo-garantia-${opcion.value}`}>
              {opcion.label}
            </Checkbox>
          ))}
        </Checkbox.Group>
      </Form.Item>
      <div className={styles.actions}>
        <Button type="primary" htmlType="submit" loading={guardando} data-testid="perfil-legajo-guardar">
          Guardar
        </Button>
        <Button onClick={onCancelar} disabled={guardando} data-testid="perfil-legajo-cancelar">
          Cancelar
        </Button>
      </div>
    </Form>
  )
}

/** El legajo del usuario en sesión, en lectura o en edición. */
export function LegajoBloque({ legajo, defaultOpen = false, onActualizado, onCambiosSinGuardar }: LegajoBloqueProps) {
  // ─── Estado local ───────────────────────────────────────────────────
  const [editando, setEditando] = useState(false)
  const [exito, setExito] = useState<string | null>(null)

  // ─── Handlers ───────────────────────────────────────────────────────
  function editar(): void {
    setExito(null)
    setEditando(true)
  }

  function guardado(nuevo: LegajoUsuario): void {
    onActualizado(nuevo)
    setEditando(false)
    setExito('Guardamos tu legajo. Se va a precargar en tus próximas solicitudes.')
  }

  // ─── Render ─────────────────────────────────────────────────────────
  const items = [
    {
      label: 'Situación ocupacional',
      value:
        legajo.occupation === 'sin_informar' ? (
          <SinCargar campo="ocupacion" onCompletar={editar} />
        ) : (
          <span data-testid="perfil-legajo-ocupacion">{OCUPACION_LABEL[legajo.occupation]}</span>
        ),
    },
    {
      label: 'Ingreso mensual declarado',
      value:
        legajo.monthlyIncome === null ? (
          <SinCargar campo="ingresos" onCompletar={editar} />
        ) : (
          <span data-testid="perfil-legajo-ingresos">
            <MoneyAmount amount={legajo.monthlyIncome} />
          </span>
        ),
    },
    {
      label: 'Garantías que podés ofrecer',
      value:
        legajo.guarantees.length === 0 ? (
          <SinCargar campo="garantias" onCompletar={editar} />
        ) : (
          <span data-testid="perfil-legajo-garantias">{legajo.guarantees.map((garantia) => GARANTIA_LABEL[garantia]).join(', ')}</span>
        ),
    },
  ]

  return (
    <BloquePerfil
      testId="perfil-legajo"
      title="Mi legajo"
      description="Se precarga en cada solicitud que envíes. El dueño lo ve recién cuando te postulás, nunca antes."
      badge={<ChipLegajo legajo={legajo} />}
      defaultOpen={defaultOpen}
    >
      <div className={styles.stack}>
        {exito && !editando && (
          <Alert type="success" showIcon closable={{ 'aria-label': 'Cerrar el aviso' }} onClose={() => setExito(null)} title={exito} data-testid="perfil-legajo-exito" />
        )}
        <AvisoLegajo legajo={legajo} />
        {!editando ? (
          <>
            <DetailList items={items} column={1} />
            <div className={styles.actions}>
              <Button onClick={editar} data-testid="perfil-legajo-editar">
                Editar legajo
              </Button>
            </div>
          </>
        ) : (
          <FormularioLegajo legajo={legajo} onGuardado={guardado} onCancelar={() => setEditando(false)} onCambiosSinGuardar={onCambiosSinGuardar} />
        )}
      </div>
    </BloquePerfil>
  )
}
