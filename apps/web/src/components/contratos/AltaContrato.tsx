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
 * - Borrador: "Guardar borrador" en el encabezado de cada paso; el primero
 *   pasa la URL a `/[id]/editar` (`router.replace`); "Eliminar borrador"
 *   con confirmación.
 * - Paso 4: la casilla de revisión es obligatoria y "Enviar a firmar" pide
 *   confirmación nombrando a los dos firmantes (decisión del PO: locador y
 *   locatario). Al enviar, el resultado va dentro del alta.
 * Usa `WizardLayout` de `@rentar/ui` (como el alta de propiedad).
 *
 * Aviso de salida (US-21, `AvisoCambiosProvider`): marca cambios mientras
 * haya algo que no está en el borrador guardado.
 *
 * De dónde saca los datos: `contratos.service#prepararContrato` (nuevo) o
 * `#getContrato` (borrador); guarda con `#guardarBorrador`, `#eliminarBorrador`
 * y `#enviarAFirmar`.
 * Quién lo usa: `app/(app)/panel/contratos/nuevo/page.tsx` y `[id]/editar/page.tsx`.
 */
import { useCallback, useMemo, useState } from 'react'
import { Alert, Button, Skeleton } from 'antd'
import { DeleteOutlined, SaveOutlined } from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import type { ClausulaContrato, CondicionesNuevoContrato, ContratoBorrador, ContratoEnviado, DatosContrato, GaranteContrato } from '@rentar/shared-types'
import { ConfirmActionModal, EmptyState, PageHeader, WizardLayout } from '@rentar/ui'
import { completarClausulas } from '@/lib/contratos/plantilla'
import { errorDeClausula, errorDeGarantes, erroresCondiciones, errorParaEnviar } from '@/lib/contratos/validaciones'
import { useServiceCall } from '@/lib/hooks/useServiceCall'
import { useAvisoCambiosSinGuardar } from '@/lib/navigation/AvisoCambiosProvider'
import { hoy } from '@/lib/utils/fechas'
import { eliminarBorrador, enviarAFirmar, getContrato, guardarBorrador, prepararContrato } from '@/services/contratos.service'
import { ServiceError } from '@/services/shared/errors'
import { PasoClausulas } from './PasoClausulas'
import { PasoCondiciones } from './PasoCondiciones'
import { PasoPartes } from './PasoPartes'
import { PasoRevision } from './PasoRevision'
import { ResultadoEnvio } from './ResultadoEnvio'
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

/** Índice del último paso (Revisión). */
const ULTIMO_PASO = PASOS_CONTRATO.length - 1

/** Props de {@link AltaContrato}. Uno de los dos ids. */
interface AltaContratoProps {
  /** Solicitud aceptada de la que nace (`/nuevo?solicitud=`). */
  solicitudId?: string
  /** Borrador a retomar (`/[id]/editar`). */
  contratoId?: string
  /** `true` al llegar del primer "Guardar borrador" (`?guardado=1`): muestra el aviso. */
  recienGuardado?: boolean
  /** `true` al llegar de "Cancelar envío" del detalle (`?envio=cancelado`, US-07): muestra el aviso. */
  envioCancelado?: boolean
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

/** Mensaje de un error de service, o uno genérico. */
function mensajeDe(error: unknown, generico: string): string {
  return error instanceof ServiceError ? error.message : generico
}

// ─── Editor (con el contrato ya cargado) ────────────────────────────────

/** Props de {@link EditorContrato}. */
interface EditorContratoProps {
  inicial: ContratoBorrador
  recienGuardado: boolean
  envioCancelado: boolean
}

/** El wizard, con el contrato cargado. Se monta de nuevo si cambia el contrato (`key`). */
function EditorContrato({ inicial, recienGuardado, envioCancelado }: EditorContratoProps) {
  const router = useRouter()

  // ─── Estado local ───────────────────────────────────────────────────
  const [borrador, setBorrador] = useState<ContratoBorrador>(inicial)
  // US-05: "un borrador se puede retomar desde el paso en que quedó".
  const [paso, setPaso] = useState(() => Math.min(Math.max(inicial.ultimoPaso, 0), ULTIMO_PASO))
  /** Pasos en los que ya se tocó "Siguiente" (o "Enviar"): ahí se muestran todos los errores. */
  const [conErrores, setConErrores] = useState<ReadonlySet<number>>(() => new Set())
  const [errorPaso, setErrorPaso] = useState<string | null>(null)
  /** Lo último guardado (o lo que vino al abrir), para saber si hay cambios. */
  const [guardado, setGuardado] = useState(() => huella(inicial))
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(() => {
    // US-07: "el contrato vuelve a 'borrador' y se borran las firmas registradas".
    if (envioCancelado) return 'Cancelaste el envío: el contrato volvió a borrador y se borraron las firmas. Podés editarlo y volver a enviarlo.'
    return recienGuardado ? 'Guardamos el borrador. Lo retomás desde Contratos cuando quieras.' : null
  })
  const [errorAccion, setErrorAccion] = useState<string | null>(null)
  const [acepto, setAcepto] = useState(false)
  const [confirmarEnvio, setConfirmarEnvio] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState<ContratoEnviado | null>(null)
  const [confirmarEliminar, setConfirmarEliminar] = useState(false)
  const [eliminando, setEliminando] = useState(false)

  const hayCambios = !enviado && huella(borrador) !== guardado
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

  const cambiarClausulas = useCallback((clausulas: ClausulaContrato[]) => {
    setBorrador((actual) => ({ ...actual, clausulas }))
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

  /** US-05: "Se puede guardar el contrato como borrador desde cualquier paso." */
  async function guardar(): Promise<void> {
    setGuardando(true)
    setErrorAccion(null)
    setAviso(null)
    try {
      const nuevo = await guardarBorrador(borrador.id, datosDe(borrador, paso))
      setGuardado(huella(nuevo))
      if (!borrador.id && nuevo.id) {
        // El primer guardado: la URL pasa a la del borrador, así una recarga lo retoma.
        router.replace(`/panel/contratos/${encodeURIComponent(nuevo.id)}/editar?guardado=1`)
        return
      }
      setBorrador(nuevo)
      setAviso('Guardamos el borrador. Lo retomás desde Contratos cuando quieras.')
    } catch (error) {
      setErrorAccion(mensajeDe(error, 'No pudimos guardar el borrador. Probá de nuevo.'))
    } finally {
      setGuardando(false)
    }
  }

  /** US-05: "Se puede eliminar un borrador, previa confirmación." */
  async function eliminar(): Promise<void> {
    if (!borrador.id) return
    setEliminando(true)
    setErrorAccion(null)
    try {
      await eliminarBorrador(borrador.id)
      setGuardado(huella(borrador))
      router.push('/panel/contratos')
    } catch (error) {
      setErrorAccion(mensajeDe(error, 'No pudimos eliminar el borrador. Probá de nuevo.'))
      setConfirmarEliminar(false)
    } finally {
      setEliminando(false)
    }
  }

  /** "Enviar a firmar" (US-05, paso 4): la casilla y los datos, y después la confirmación. */
  function pedirEnvio(): void {
    setConErrores((actual) => new Set(actual).add(ULTIMO_PASO))
    if (!acepto) {
      setErrorPaso(null)
      return
    }
    const error = errorParaEnviar(borrador, hoy().format('YYYY-MM-DD'))
    if (error) {
      setErrorPaso(error)
      return
    }
    setErrorPaso(null)
    setConfirmarEnvio(true)
  }

  async function enviar(): Promise<void> {
    setEnviando(true)
    setErrorAccion(null)
    try {
      const resultado = await enviarAFirmar(borrador.id, datosDe(borrador, ULTIMO_PASO))
      setGuardado(huella(borrador))
      setEnviado(resultado)
      setConfirmarEnvio(false)
    } catch (error) {
      setErrorAccion(mensajeDe(error, 'No pudimos enviar el contrato. Probá de nuevo.'))
      setConfirmarEnvio(false)
    } finally {
      setEnviando(false)
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────
  const nombreLocador = `${borrador.locador.nombre} ${borrador.locador.apellido}`.trim()
  const nombreLocatario = `${borrador.locatario.nombre} ${borrador.locatario.apellido}`.trim()
  const titulo = borrador.id ? 'Continuar contrato' : 'Nuevo contrato'
  const miga = [...MIGA.slice(0, 2), { label: titulo }]
  const subtitulo = `${borrador.propiedad.address} · ${nombreLocatario}`

  if (enviado) {
    return (
      <div className={styles.page}>
        <PageHeader title="Contrato enviado" subtitle={subtitulo} breadcrumb={miga} />
        <ResultadoEnvio enviado={enviado} direccion={borrador.propiedad.address} />
      </div>
    )
  }

  const pasoConError = errorPaso && paso < ULTIMO_PASO ? paso : null
  const steps = PASOS_CONTRATO.map((definicion, indice) => ({
    key: definicion.key,
    title: definicion.title,
    status: pasoConError === indice ? ('error' as const) : undefined,
    content:
      indice === 0 ? (
        <PasoPartes borrador={borrador} onGarantesChange={cambiarGarantes} mostrarErrores={conErrores.has(0)} />
      ) : indice === 1 ? (
        <PasoCondiciones borrador={borrador} onCondicionesChange={cambiarCondiciones} mostrarErrores={conErrores.has(1)} />
      ) : indice === 2 ? (
        <PasoClausulas borrador={borrador} onClausulasChange={cambiarClausulas} mostrarErrores={conErrores.has(2)} />
      ) : (
        <PasoRevision borrador={borrador} onEditar={irAlPaso} acepto={acepto} onAceptoChange={setAcepto} mostrarErrorCasilla={conErrores.has(ULTIMO_PASO)} />
      ),
  }))

  const acciones = (
    <span className={styles.headerAcciones}>
      {borrador.id && (
        <Button danger icon={<DeleteOutlined />} onClick={() => setConfirmarEliminar(true)} disabled={guardando || enviando} data-testid="contrato-eliminar-borrador">
          Eliminar borrador
        </Button>
      )}
      <Button icon={<SaveOutlined />} onClick={() => void guardar()} loading={guardando} disabled={enviando} data-testid="contrato-guardar-borrador">
        Guardar borrador
      </Button>
    </span>
  )

  return (
    <div className={styles.page} data-testid="contrato-alta">
      <PageHeader title={titulo} subtitle={subtitulo} breadcrumb={miga} actions={acciones} />
      {aviso && <Alert type="success" showIcon closable={{ 'aria-label': 'Cerrar el aviso' }} onClose={() => setAviso(null)} title={aviso} data-testid="contrato-borrador-guardado" />}
      {errorAccion && <Alert type="error" showIcon closable={{ 'aria-label': 'Cerrar el aviso' }} onClose={() => setErrorAccion(null)} title={errorAccion} data-testid="contrato-error" />}
      {errorPaso && (
        <Alert
          type="error"
          showIcon
          title={paso === ULTIMO_PASO ? 'Falta algo para enviar a firmar' : 'Revisá el paso antes de seguir'}
          description={errorPaso}
          data-testid="contrato-error-paso"
        />
      )}
      {/* NOTA: el envoltorio solo sirve para mostrar "Anterior" en el paso 4 en móvil (ver `.wizard` en el CSS). */}
      <div className={styles.wizard}>
        <WizardLayout
          steps={steps}
          currentStep={paso}
          onStepChange={irAlPaso}
          onFinish={pedirEnvio}
          finishLabel="Enviar a firmar"
          navigableSteps
          loading={enviando}
          data-testid="contrato-wizard"
        />
      </div>

      {/* US-05: "Se debe solicitar confirmación antes de enviar a firmar, indicando quiénes deben firmar." */}
      <ConfirmActionModal
        open={confirmarEnvio}
        title="¿Enviar el contrato a firmar?"
        description={`Lo van a firmar ${nombreLocador} (locador, vos) y ${nombreLocatario} (locatario), cada uno desde su panel. Después de enviarlo ya no se puede editar.`}
        confirmLabel="Enviar a firmar"
        cancelLabel="Seguir revisando"
        confirmLoading={enviando}
        onConfirm={() => void enviar()}
        onCancel={() => setConfirmarEnvio(false)}
        data-testid="contrato-enviar-modal"
      />

      <ConfirmActionModal
        open={confirmarEliminar}
        title="¿Eliminar este borrador?"
        description={`Se borra el contrato en borrador de ${borrador.propiedad.address} con ${nombreLocatario}. La solicitud aceptada queda como está.`}
        confirmLabel="Eliminar borrador"
        cancelLabel="Cancelar"
        danger
        confirmLoading={eliminando}
        onConfirm={() => void eliminar()}
        onCancel={() => setConfirmarEliminar(false)}
        data-testid="contrato-eliminar-modal"
      />
    </div>
  )
}

// ─── Carga ──────────────────────────────────────────────────────────────

/** Alta de contrato: carga el contrato (nuevo o borrador) y monta el wizard. */
export function AltaContrato({ solicitudId, contratoId, recienGuardado = false, envioCancelado = false }: AltaContratoProps) {
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
            description={
              contrato.status === 'pendiente_firma'
                ? `${contrato.code ?? 'El contrato'} ya se envió a firmar. Para cambiar algo, cancelá el envío desde su detalle (mientras el locatario no haya firmado).`
                : `${contrato.code ?? 'El contrato'} ya no es un borrador.`
            }
            action={
              <span className={styles.acciones}>
                <Button type="primary" onClick={() => router.push(`/panel/contratos/${encodeURIComponent(contrato.id ?? '')}`)} data-testid="contrato-ver-detalle">
                  Ver contrato
                </Button>
                <Button onClick={() => router.push('/panel/contratos')} data-testid="contrato-ir-contratos">
                  Ir a Contratos
                </Button>
              </span>
            }
          />
        </div>
      </div>
    )
  }

  return <EditorContrato key={contrato.id ?? `nuevo-${contrato.solicitudId}`} inicial={contrato} recienGuardado={recienGuardado} envioCancelado={envioCancelado} />
}
