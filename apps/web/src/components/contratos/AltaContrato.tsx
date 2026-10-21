'use client'

/**
 * AltaContrato.tsx — el alta de contrato en 4 pasos: `/panel/contratos/nuevo?solicitud=<id>`
 * (desde una solicitud aceptada) y `/panel/contratos/[id]/editar` (retomar un borrador).
 *
 * Cubre: US-05 Registrar contrato de alquiler:
 * - "El alta se realiza en 4 pasos (Partes y garantes, Condiciones,
 *   Cláusulas y Revisión). Se debe mostrar el paso actual y se puede volver
 *   a los pasos anteriores sin perder lo cargado."
 * - Cada paso se valida al tocar "Siguiente"; volver atrás no valida.
 * Usa `WizardLayout` de `@rentar/ui` (como el alta de propiedad).
 *
 * Aviso de salida (US-21, `AvisoCambiosProvider`): marca cambios mientras
 * haya algo que no está en el borrador guardado.
 *
 * De dónde saca los datos: `contratos.service#prepararContrato` (nuevo) o
 * `#getContrato` (borrador).
 * Quién lo usa: `app/(app)/panel/contratos/nuevo/page.tsx` y `[id]/editar/page.tsx`.
 */
import { useCallback, useMemo, useState } from 'react'
import { Alert, Button, Skeleton } from 'antd'
import { useRouter } from 'next/navigation'
import type { CondicionesNuevoContrato, ContratoBorrador, DatosContrato, GaranteContrato } from '@rentar/shared-types'
import { EmptyState, PageHeader, WizardLayout } from '@rentar/ui'
import { completarClausulas } from '@/lib/contratos/plantilla'
import { errorDeClausula, errorDeGarantes, erroresCondiciones } from '@/lib/contratos/validaciones'
import { useServiceCall } from '@/lib/hooks/useServiceCall'
import { useAvisoCambiosSinGuardar } from '@/lib/navigation/AvisoCambiosProvider'
import { hoy } from '@/lib/utils/fechas'
import { getContrato, prepararContrato } from '@/services/contratos.service'
import { PasoCondiciones } from './PasoCondiciones'
import { PasoPartes } from './PasoPartes'
import styles from './AltaContrato.module.css'

const MIGA = [
  { label: 'Mi panel', href: '/panel' },
  { label: 'Contratos', href: '/panel/contratos' },
  { label: 'Nuevo contrato' },
]

/** Los 4 pasos de la US, en orden. */
export const PASOS_CONTRATO = [
  { key: 'partes', title: 'Partes y garantes' },
  { key: 'condiciones', title: 'Condiciones' },
  { key: 'clausulas', title: 'Cláusulas' },
  { key: 'revision', title: 'Revisión' },
] as const

/** Props de {@link AltaContrato}. Uno de los dos. */
interface AltaContratoProps {
  /** Solicitud aceptada de la que nace (`/nuevo?solicitud=`). */
  solicitudId?: string
  /** Borrador a retomar (`/[id]/editar`). */
  contratoId?: string
}

/** Lo que se guarda del borrador, en el paso actual. */
export function datosDe(borrador: ContratoBorrador, paso: number): DatosContrato {
  return { solicitudId: borrador.solicitudId, garantes: borrador.garantes, condiciones: borrador.condiciones, clausulas: borrador.clausulas, ultimoPaso: paso }
}

/** Huella de lo cargado, sin el paso (moverse entre pasos no es un cambio). */
export function huella(borrador: ContratoBorrador): string {
  return JSON.stringify({ garantes: borrador.garantes, condiciones: borrador.condiciones, clausulas: borrador.clausulas })
}

/**
 * Primer error del paso, o `null` (lo que frena "Siguiente"):
 * 0 garantes, 1 condiciones, 2 cláusulas. La revisión (3) se valida al enviar.
 */
export function errorDelPaso(borrador: ContratoBorrador, paso: number): string | null {
  if (paso === 0) return errorDeGarantes(borrador.garantes, [borrador.locador, borrador.locatario])
  if (paso === 1) return Object.values(erroresCondiciones(borrador.condiciones, hoy().format('YYYY-MM-DD')))[0] ?? null
  if (paso === 2) {
    for (const [indice, clausula] of borrador.clausulas.entries()) {
      const error = errorDeClausula(clausula)
      if (error) return `Cláusula ${indice + 1}: ${error}`
    }
  }
  return null
}

// ─── Editor (con el contrato ya cargado) ────────────────────────────────

/** Props de {@link EditorContrato}. */
interface EditorContratoProps {
  inicial: ContratoBorrador
}

/** El wizard, con el contrato cargado. Se monta de nuevo si cambia el contrato (`key`). */
function EditorContrato({ inicial }: EditorContratoProps) {
  // ─── Estado local ───────────────────────────────────────────────────
  const [borrador, setBorrador] = useState<ContratoBorrador>(inicial)
  // US-05: "un borrador se puede retomar desde el paso en que quedó".
  const [paso, setPaso] = useState(() => Math.min(Math.max(inicial.ultimoPaso, 0), PASOS_CONTRATO.length - 1))
  /** Pasos en los que ya se tocó "Siguiente": ahí se muestran todos los errores. */
  const [conErrores, setConErrores] = useState<ReadonlySet<number>>(() => new Set())
  const [errorPaso, setErrorPaso] = useState<string | null>(null)
  /** Lo último guardado (o lo que vino al abrir), para saber si hay cambios. */
  const [guardado] = useState(() => huella(inicial))

  const hayCambios = huella(borrador) !== guardado
  useAvisoCambiosSinGuardar(hayCambios)

  // ─── Handlers ───────────────────────────────────────────────────────
  /** Los garantes y las condiciones completan de nuevo la plantilla (US-05, paso 3). */
  const cambiarGarantes = useCallback((garantes: GaranteContrato[]) => {
    setBorrador((actual) => {
      const nuevo = { ...actual, garantes }
      return { ...nuevo, clausulas: completarClausulas(nuevo.clausulas, nuevo) }
    })
  }, [])

  const cambiarCondiciones = useCallback((condiciones: CondicionesNuevoContrato) => {
    setBorrador((actual) => {
      const nuevo = { ...actual, condiciones }
      return { ...nuevo, clausulas: completarClausulas(nuevo.clausulas, nuevo) }
    })
  }, [])

  /** Hacia adelante valida el paso actual; hacia atrás, nunca (US-05: "sin perder lo cargado"). */
  function irAlPaso(siguiente: number): void {
    if (siguiente > paso) {
      const error = errorDelPaso(borrador, paso)
      if (error) {
        setConErrores((actual) => new Set(actual).add(paso))
        setErrorPaso(error)
        return
      }
    }
    setErrorPaso(null)
    setPaso(siguiente)
  }

  // ─── Render ─────────────────────────────────────────────────────────
  const pasoConError = errorPaso ? paso : null
  const steps = PASOS_CONTRATO.map((definicion, indice) => ({
    key: definicion.key,
    title: definicion.title,
    status: pasoConError === indice ? ('error' as const) : undefined,
    content:
      indice === 0 ? (
        <PasoPartes borrador={borrador} onGarantesChange={cambiarGarantes} mostrarErrores={conErrores.has(0)} />
      ) : indice === 1 ? (
        <PasoCondiciones borrador={borrador} onCondicionesChange={cambiarCondiciones} mostrarErrores={conErrores.has(1)} />
      ) : (
        <p className={styles.referencia}>Este paso se completa en el próximo commit.</p>
      ),
  }))

  return (
    <div className={styles.page} data-testid="contrato-alta">
      <PageHeader
        title="Nuevo contrato"
        subtitle={`${borrador.propiedad.address} · ${`${borrador.locatario.nombre} ${borrador.locatario.apellido}`.trim()}`}
        breadcrumb={MIGA}
      />
      {errorPaso && <Alert type="error" showIcon title="Revisá el paso antes de seguir" description={errorPaso} data-testid="contrato-error-paso" />}
      <WizardLayout steps={steps} currentStep={paso} onStepChange={irAlPaso} navigableSteps data-testid="contrato-wizard" />
    </div>
  )
}

// ─── Carga ──────────────────────────────────────────────────────────────

/** Alta de contrato: carga el contrato (nuevo o borrador) y monta el wizard. */
export function AltaContrato({ solicitudId, contratoId }: AltaContratoProps) {
  const router = useRouter()
  const cargar = useCallback(() => (contratoId ? getContrato(contratoId) : prepararContrato(solicitudId ?? '')), [contratoId, solicitudId])
  const carga = useServiceCall(cargar)
  const titulo = contratoId ? 'Continuar contrato' : 'Nuevo contrato'
  const miga = useMemo(() => [...MIGA.slice(0, 2), { label: titulo }], [titulo])

  if (carga.status === 'cargando') {
    return (
      <div className={styles.page} data-testid="contrato-cargando">
        <PageHeader title={titulo} breadcrumb={miga} />
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    )
  }

  if (carga.status === 'error') {
    // 409 (la solicitud ya originó un contrato, no está aceptada o la
    // propiedad ya tiene uno) y 404: el motivo y la salida a las listas.
    return (
      <div className={styles.page}>
        <PageHeader title={titulo} breadcrumb={miga} />
        <div className={styles.bloqueado} data-testid="contrato-no-disponible">
          <EmptyState
            title={carga.code === 'conflict' ? 'No se puede iniciar este contrato' : 'No pudimos abrir el contrato'}
            description={carga.message}
            action={
              <span className={styles.acciones}>
                <Button type="primary" onClick={() => router.push('/panel/contratos')} data-testid="contrato-ir-contratos">
                  Ir a Contratos
                </Button>
                {carga.code !== 'conflict' && carga.code !== 'not_found' && (
                  <Button onClick={carga.reintentar} data-testid="contrato-reintentar">
                    Reintentar
                  </Button>
                )}
              </span>
            }
          />
        </div>
      </div>
    )
  }

  const contrato = carga.data
  // US-05: "al enviarlo … no se puede editar".
  if (contrato.status !== 'borrador') {
    return (
      <div className={styles.page}>
        <PageHeader title={titulo} breadcrumb={miga} />
        <div className={styles.bloqueado} data-testid="contrato-no-editable">
          <EmptyState
            title="Este contrato ya no se puede editar"
            description={`${contrato.code ?? 'El contrato'} ya se envió a firmar. Para cambiar algo, el envío se tiene que cancelar (llega con la firma, en la próxima tanda).`}
            action={
              <Button type="primary" onClick={() => router.push('/panel/contratos')} data-testid="contrato-ir-contratos">
                Ir a Contratos
              </Button>
            }
          />
        </div>
      </div>
    )
  }

  return <EditorContrato key={contrato.id ?? `nuevo-${contrato.solicitudId}`} inicial={contrato} />
}
