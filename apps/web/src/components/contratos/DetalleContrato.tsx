'use client'

/**
 * DetalleContrato.tsx — `/panel/contratos/[id]`, el detalle de un contrato.
 *
 * Cubre: US-07 Firmar contrato de alquiler, "Detalle del contrato",
 * "Rechazo y cancelación" y "Contrato vigente":
 * - Estado de cada firmante (pendiente / firmado con fecha y hora /
 *   rechazado con el motivo) y cuántas firmas faltan.
 * - Datos principales: propiedad, partes, garantes, vigencia, monto
 *   inicial, depósito, ajuste y día de vencimiento.
 * - El documento (`VisorContrato`), "Descargar PDF" en cualquier estado
 *   (`lib/contratos/pdf.ts`, con `jsPDF` cargado al tocarlo) y el historial
 *   (`ActivityTimeline`).
 * - El locador firma acá (`FirmaContrato`), cancela el envío (si el
 *   locatario no firmó) y reenvía la invitación (una vez por hora).
 * - Vigente: "Firmado por todas las partes el dd/mm/aaaa"; sin firma,
 *   reenvío ni cancelación.
 * - Inexistente o ajeno: "No encontramos este contrato", sin distinguir.
 * - Un borrador abierto por esta URL va a `/[id]/editar`.
 * Decisión del PO (Sprint 3): firman el locador y el locatario; los garantes
 * se muestran como datos, sin estado de firma.
 *
 * Qué muestra (Claude Design, "Flujo de contratos" · 05 y 09): la franja de
 * estado arriba, firmantes y datos a la izquierda, documento e historial a
 * la derecha; en móvil, una sola columna.
 * NOTA (diseño vs. decisión del PO): el diseño muestra tres firmas (con el
 * garante), "el link vence el…" y el calendario de ajustes con montos
 * estimados. Acá: dos firmas, sin vencimiento de links (no hay mails) y
 * sin calendario (US-07 no lo pide).
 *
 * De dónde saca los datos: `contratos.service#getDetalleContrato`; las
 * acciones, `#cancelarEnvio` y `#reenviarInvitacion` (firmar y rechazar, en
 * `FirmaContrato`).
 * Quién lo usa: `app/(app)/panel/contratos/[id]/page.tsx`.
 */
import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Skeleton } from 'antd'
import { DownloadOutlined, MailOutlined, RollbackOutlined } from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import type { ContratoDetalle, EventoContrato, FirmanteContrato, RolFirmante } from '@rentar/shared-types'
import { ActivityTimeline, ConfirmActionModal, DetailList, EmptyState, MoneyAmount, PageHeader, SimulatedFeatureNotice, StatusTag } from '@rentar/ui'
import type { SemanticColorKey } from '@rentar/ui'
import { fechaCorta, MESES_POR_PERIODO } from '@/lib/contratos/fechas'
import { fechaYHora, firmasQueFaltan, motivoSinReenvio, NOMBRE_ROL, puedeCancelarEnvio, tituloDeEvento } from '@/lib/contratos/firmas'
import { descargarContratoPdf } from '@/lib/contratos/pdf'
import { tituloContrato } from '@/lib/contratos/plantilla'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useServiceCall } from '@/lib/hooks/useServiceCall'
import { dniParaMostrar } from '@/lib/perfil/formato'
import { ahoraIso } from '@/lib/utils/fechas'
import { cancelarEnvio, getDetalleContrato, reenviarInvitacion } from '@/services/contratos.service'
import { ServiceError } from '@/services/shared/errors'
import { CondicionesAlquiler, EncabezadoAlquiler, LocadorAlquiler, LoQueVieneAlquiler } from './FichaAlquiler'
import { FirmaContrato } from './FirmaContrato'
import { IndiceAjuste } from './IndiceAjuste'
import { VisorContrato } from './VisorContrato'
import styles from './DetalleContrato.module.css'

const MIGA_BASE = [
  { label: 'Mi panel', href: '/panel' },
  { label: 'Contratos', href: '/panel/contratos' },
]

/** Props de {@link DetalleContrato}. */
interface DetalleContratoProps {
  contratoId: string
}

/** "Nombre Apellido" de una parte. */
function nombreDe(parte: ContratoDetalle['locador']): string {
  return `${parte.nombre} ${parte.apellido}`.trim()
}

/** Color del punto de cada evento del historial. */
const COLOR_EVENTO: Record<EventoContrato['tipo'], SemanticColorKey> = {
  creado: 'neutral',
  enviado: 'info',
  firmado: 'success',
  rechazado: 'error',
  reenviado: 'info',
  envio_cancelado: 'warning',
  vigente: 'success',
}

/**
 * Historial (US-07: "con fecha y hora"): `ActivityTimeline` con
 * `dateFormat="absolute"` (decisión del PO, tanda 3). El motivo de un
 * rechazo va en la descripción.
 */
function eventosDelHistorial(historial: readonly EventoContrato[]) {
  return historial.map((evento) => ({
    id: evento.id,
    title: tituloDeEvento(evento),
    date: evento.fecha,
    colorKey: COLOR_EVENTO[evento.tipo],
    description: evento.motivo ? `Motivo: "${evento.motivo}"` : undefined,
  }))
}

/** Lo que se ve debajo del nombre de cada firmante (US-07: fecha y hora, o el motivo). */
function estadoDeFirmante(firmante: FirmanteContrato): string {
  const rol = NOMBRE_ROL[firmante.rol]
  if (firmante.estado === 'firmado' && firmante.firmadoEl) return `${rol} · firmó el ${fechaYHora(firmante.firmadoEl)}`
  if (firmante.estado === 'rechazado' && firmante.rechazadoEl) return `${rol} · rechazó la firma el ${fechaYHora(firmante.rechazadoEl)}`
  return `${rol} · todavía no firmó`
}

/**
 * Rol de quien mira el contrato, o `null`.
 * NOTA: sale de comparar la sesión con las partes; los ids son los mismos que manda `/usuarios/me`.
 */
export function rolEnContrato(contrato: Pick<ContratoDetalle, 'locador' | 'locatario'>, userId: string | undefined): RolFirmante | null {
  if (!userId) return null
  if (userId === contrato.locador.userId) return 'locador'
  if (userId === contrato.locatario.userId) return 'locatario'
  return null
}

/** Iniciales para el avatar. */
function iniciales(nombre: string): string {
  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? '')
    .join('')
}

// ─── Contenido (con el contrato cargado) ────────────────────────────────

/** Props de {@link VistaContrato}. */
interface VistaContratoProps {
  inicial: ContratoDetalle
  /** Rol de quien mira (`null` si no se pudo saber: no ve acciones). */
  miRol: RolFirmante | null
  /** Migas: las del locador (Contratos) o las del locatario (Mi alquiler). */
  miga: { label: string; href?: string }[]
  /** Título de la página; por defecto, "Contrato CT-…". */
  titulo?: string
  /**
   * `'locatario'`: la ficha de Mi alquiler (US-27): foto y dirección arriba,
   * "Lo que viene", condiciones y el locador con su contacto en lugar de
   * "Datos del contrato". @default 'locador'
   */
  vista?: 'locador' | 'locatario'
}

/**
 * El contrato cargado, con lo que le toca a cada parte: el locador firma,
 * cancela el envío y reenvía; el locatario firma o rechaza. Las acciones lo
 * van actualizando. La usan el detalle del locador y Mi alquiler
 * (`MiAlquiler.tsx`), que en la tanda 4 suma sus propias secciones.
 */
export function VistaContrato({ inicial, miRol, miga, titulo: tituloPagina, vista = 'locador' }: VistaContratoProps) {
  const router = useRouter()

  // ─── Estado local ───────────────────────────────────────────────────
  const [contrato, setContrato] = useState<ContratoDetalle>(inicial)
  const [aviso, setAviso] = useState<string | null>(null)
  const [errorAccion, setErrorAccion] = useState<string | null>(null)
  const [confirmarCancelar, setConfirmarCancelar] = useState(false)
  const [cancelando, setCancelando] = useState(false)
  const [reenviando, setReenviando] = useState<RolFirmante | null>(null)
  const [descargando, setDescargando] = useState(false)
  /** "Ahora", para el límite de un reenvío por hora; se renueva cada 30 s. */
  const [ahora, setAhora] = useState(ahoraIso)

  useEffect(() => {
    const intervalo = window.setInterval(() => setAhora(ahoraIso()), 30_000)
    return () => window.clearInterval(intervalo)
  }, [])

  const { locador, locatario, condiciones, propiedad } = contrato
  const pendiente = contrato.status === 'pendiente_firma'
  const soyLocador = miRol === 'locador'
  const miFirma = contrato.firmantes.find((firmante) => firmante.rol === miRol) ?? null
  const faltan = firmasQueFaltan(contrato.firmantes)
  const cancelable = puedeCancelarEnvio(contrato)
  const rechazoLocatario = contrato.firmantes.find((firmante) => firmante.rol === 'locatario' && firmante.estado === 'rechazado') ?? null
  const titulo = tituloContrato(contrato)

  // ─── Handlers ───────────────────────────────────────────────────────
  /** Después de firmar o rechazar (`FirmaContrato`). */
  function alCambiar(actualizado: ContratoDetalle): void {
    setContrato(actualizado)
    setErrorAccion(null)
    if (actualizado.status === 'vigente') setAviso('Firmaste el contrato. Firmaron las dos partes: el contrato está vigente y la propiedad pasó a alquilada.')
    else if (miRol && actualizado.firmantes.find((firmante) => firmante.rol === miRol)?.estado === 'rechazado') setAviso('Rechazaste la firma. El contrato sigue pendiente de firma.')
    else setAviso(`Firmaste el contrato. Falta la firma de ${nombreDe(miRol === 'locador' ? locatario : locador)}.`)
  }

  async function cancelar(): Promise<void> {
    setCancelando(true)
    setErrorAccion(null)
    try {
      await cancelarEnvio(contrato.id ?? '')
      setConfirmarCancelar(false)
      // US-07: "el contrato vuelve a 'borrador'": se sigue editando en el alta.
      router.replace(`/panel/contratos/${encodeURIComponent(contrato.id ?? '')}/editar?envio=cancelado`)
    } catch (error) {
      setErrorAccion(error instanceof ServiceError ? error.message : 'No pudimos cancelar el envío. Probá de nuevo.')
      setCancelando(false)
    }
  }

  /** US-07: "permitir descargarlo en PDF en cualquier estado". `jsPDF` se carga recién acá. */
  async function descargar(): Promise<void> {
    setDescargando(true)
    setErrorAccion(null)
    try {
      await descargarContratoPdf(contrato)
    } catch {
      setErrorAccion('No pudimos armar el PDF. Probá de nuevo; el documento se sigue viendo en la pantalla.')
    } finally {
      setDescargando(false)
    }
  }

  async function reenviar(rol: RolFirmante): Promise<void> {
    setReenviando(rol)
    setErrorAccion(null)
    try {
      const actualizado = await reenviarInvitacion(contrato.id ?? '', rol)
      setContrato(actualizado)
      setAhora(ahoraIso())
      const firmante = actualizado.firmantes.find((item) => item.rol === rol)
      setAviso(`Le reenviaste la invitación a ${firmante?.nombre ?? NOMBRE_ROL[rol]}. Quedó registrado en el historial (no se mandó ningún mail).`)
    } catch (error) {
      setErrorAccion(error instanceof ServiceError ? error.message : 'No pudimos reenviar la invitación. Probá de nuevo.')
    } finally {
      setReenviando(null)
    }
  }

  // ─── Render: partes ─────────────────────────────────────────────────
  const vigencia = condiciones.startDate && contrato.endDate
    ? `Del ${fechaCorta(condiciones.startDate)} al ${fechaCorta(contrato.endDate)}${condiciones.durationMonths ? ` · ${condiciones.durationMonths} meses` : ''}`
    : 'Sin dato'
  const parte = (persona: ContratoDetalle['locador']) => (
    <span className={styles.valorCompuesto}>
      <span>{nombreDe(persona) || 'Sin dato'}</span>
      {persona.dni && <span className={styles.valorSecundario}>DNI {dniParaMostrar(persona.dni)}</span>}
    </span>
  )
  const datos = [
    { label: 'Propiedad', value: `${propiedad.address}${propiedad.neighborhoodName ? ` · ${propiedad.neighborhoodName}` : ''}` },
    { label: 'Locador', value: parte(locador) },
    { label: 'Locatario', value: parte(locatario) },
    {
      label: contrato.garantes.length === 1 ? 'Garante' : 'Garantes',
      value:
        contrato.garantes.length === 0 ? (
          'Sin garantes'
        ) : (
          <span className={styles.valorCompuesto} data-testid="contrato-detalle-garantes">
            {contrato.garantes.map((garante) => (
              <span key={garante.key}>
                {garante.fullName}
                {garante.dni ? ` · DNI ${dniParaMostrar(garante.dni)}` : ''}
                <span className={styles.valorSecundario}> · {garante.email}</span>
              </span>
            ))}
          </span>
        ),
    },
    { label: 'Vigencia', value: vigencia },
    { label: 'Monto inicial', value: condiciones.initialAmount === null ? 'Sin dato' : <MoneyAmount amount={condiciones.initialAmount} emphasis /> },
    { label: 'Depósito', value: condiciones.deposit === null ? 'Sin dato' : <MoneyAmount amount={condiciones.deposit} /> },
    {
      label: 'Ajuste',
      value: (
        <span className={styles.ajuste}>
          <IndiceAjuste indice={condiciones.adjustmentIndex} />
          {condiciones.adjustmentIndex !== 'sin_ajuste' && condiciones.adjustmentPeriod ? `cada ${MESES_POR_PERIODO[condiciones.adjustmentPeriod]} meses` : null}
        </span>
      ),
    },
    { label: 'Vencimiento del pago', value: condiciones.paymentDueDay === null ? 'Sin dato' : `Día ${condiciones.paymentDueDay} de cada mes` },
  ]

  // ─── Render ─────────────────────────────────────────────────────────
  const firmaPendienteMia = pendiente && miFirma?.estado === 'pendiente'
  const esFicha = vista === 'locatario'
  // US-27: un finalizado (o rescindido) se ve en solo lectura, sin "Lo que viene".
  const terminado = contrato.status === 'finalizado' || contrato.status === 'rescindido'

  return (
    <div className={styles.page} data-testid="contrato-detalle" data-estado={contrato.status}>
      <PageHeader
        title={tituloPagina ?? `Contrato ${contrato.code ?? ''}`.trim()}
        subtitle={
          esFicha
            ? `${propiedad.address}${condiciones.startDate ? ` · tu alquiler desde ${fechaCorta(condiciones.startDate)}` : ''}`
            : `${propiedad.address} · ${nombreDe(locatario) || 'Sin locatario'}${condiciones.startDate && contrato.endDate ? ` · del ${fechaCorta(condiciones.startDate)} al ${fechaCorta(contrato.endDate)}` : ''}`
        }
        breadcrumb={miga}
        actions={
          <Button icon={<DownloadOutlined />} loading={descargando} onClick={() => void descargar()} data-testid="contrato-descargar-pdf">
            Descargar PDF
          </Button>
        }
      />

      {aviso && <Alert type="success" showIcon closable={{ 'aria-label': 'Cerrar el aviso' }} onClose={() => setAviso(null)} title={aviso} data-testid="contrato-detalle-aviso" />}
      {errorAccion && <Alert type="error" showIcon closable={{ 'aria-label': 'Cerrar el error' }} onClose={() => setErrorAccion(null)} title={errorAccion} data-testid="contrato-detalle-error" />}

      {esFicha && <EncabezadoAlquiler contrato={contrato} />}

      {/* Franja de estado (Claude Design · 05): lo primero mientras faltan firmas. */}
      {pendiente ? (
        <div className={`${styles.franja} ${styles.franjaPendiente}`} data-testid="contrato-estado">
          <StatusTag domain="contrato" status="pendiente_firma" />
          <span className={styles.franjaTexto}>
            <span data-testid="contrato-faltan-firmas">
              {faltan === 1 ? 'Falta' : 'Faltan'} <strong>{faltan} de {contrato.firmantes.length} firmas</strong>.
              {contrato.enviadoEl ? ` Enviado el ${fechaCorta(contrato.enviadoEl)}.` : ''}
            </span>{' '}
            {/* Propuesta aprobada por el PO: quien rechaza no firma después; el locador cancela y reenvía. */}
            {rechazoLocatario ? (
              <strong data-testid="contrato-rechazo-explicacion">
                {soyLocador
                  ? `${locatario.nombre || 'El locatario'} rechazó la firma. Para volver a enviarlo, cancelá el envío, editá lo que haga falta y envialo de nuevo.`
                  : `Rechazaste la firma${rechazoLocatario.rechazadoEl ? ` el ${fechaCorta(rechazoLocatario.rechazadoEl)}` : ''}. El contrato sigue pendiente: si ${locador.nombre || 'el locador'} lo corrige, te lo va a volver a enviar.`}
              </strong>
            ) : (
              'Cuando firmen las dos partes, el contrato pasa a vigente y la propiedad, a alquilada.'
            )}
          </span>
          {soyLocador && (
            <span className={styles.franjaAccion}>
              <Button icon={<RollbackOutlined />} disabled={!cancelable} onClick={() => setConfirmarCancelar(true)} data-testid="contrato-cancelar-envio">
                Cancelar envío
              </Button>
              {!cancelable && (
                <span className={styles.motivo} data-testid="contrato-cancelar-envio-motivo">
                  {locatario.nombre || 'El locatario'} ya firmó: el envío no se puede cancelar.
                </span>
              )}
            </span>
          )}
        </div>
      ) : contrato.status === 'vigente' && contrato.firmadoPorTodasEl ? (
        <div className={`${styles.franja} ${styles.franjaVigente}`} data-testid="contrato-estado">
          <StatusTag domain="contrato" status="vigente" />
          <span className={styles.franjaTexto} data-testid="contrato-firmado-todas">
            Firmado por todas las partes el {fechaCorta(contrato.firmadoPorTodasEl)}.
          </span>
        </div>
      ) : (
        <div className={styles.franja} data-testid="contrato-estado">
          <StatusTag domain="contrato" status={contrato.status} />
          {!contrato.firmasRegistradas && (
            <span className={styles.franjaTexto} data-testid="contrato-sin-registro">
              Contrato anterior a RentAR: no hay registro de las firmas ni del historial.
            </span>
          )}
        </div>
      )}

      <div className={styles.grilla}>
        <div className={styles.columna}>
          {esFicha && !terminado && <LoQueVieneAlquiler contrato={contrato} />}
          {esFicha && <CondicionesAlquiler contrato={contrato} />}
          {esFicha && <LocadorAlquiler contrato={contrato} />}
          {contrato.firmasRegistradas && (
            <section className={styles.tarjeta} aria-labelledby="contrato-firmantes-titulo" data-testid="contrato-firmantes">
              <header className={styles.tarjetaEncabezado}>
                <h2 id="contrato-firmantes-titulo" className={styles.tarjetaTitulo}>
                  Firmantes
                </h2>
                <span className={styles.valorSecundario}>
                  {contrato.firmantes.length - faltan} de {contrato.firmantes.length} {contrato.firmantes.length - faltan === 1 ? 'firmó' : 'firmaron'}
                </span>
              </header>
              <ul className={styles.firmantes}>
                {contrato.firmantes.map((firmante) => {
                  const motivoReenvio = motivoSinReenvio(firmante, ahora)
                  const reenviable = soyLocador && pendiente && firmante.rol !== 'locador'
                  return (
                    <li key={firmante.rol} className={styles.firmante} data-testid="contrato-firmante" data-rol={firmante.rol} data-estado={firmante.estado}>
                      <span className={styles.avatar} data-estado={firmante.estado} aria-hidden>
                        {iniciales(firmante.nombre)}
                      </span>
                      <span className={styles.firmanteDatos}>
                        <span className={styles.firmanteNombre}>{firmante.nombre}</span>
                        <span className={styles.valorSecundario} data-testid="contrato-firmante-detalle">
                          {estadoDeFirmante(firmante)}
                        </span>
                        {firmante.estado === 'rechazado' && (
                          <span className={styles.motivoRechazo} data-testid="contrato-firmante-motivo">
                            {firmante.motivoRechazo ? `Motivo: "${firmante.motivoRechazo}"` : 'No dejó un motivo.'}
                          </span>
                        )}
                      </span>
                      <StatusTag domain="firma" status={firmante.estado} data-testid="contrato-firmante-estado" />
                      {reenviable && (
                        <span className={styles.reenvio}>
                          <Button
                            size="small"
                            icon={<MailOutlined />}
                            disabled={motivoReenvio !== null}
                            loading={reenviando === firmante.rol}
                            onClick={() => void reenviar(firmante.rol)}
                            data-testid="contrato-reenviar"
                          >
                            Reenviar invitación
                          </Button>
                          {motivoReenvio && (
                            <span className={styles.motivo} data-testid="contrato-reenviar-motivo">
                              {motivoReenvio}
                            </span>
                          )}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
              {soyLocador && pendiente && (
                <footer className={styles.tarjetaPie}>
                  <SimulatedFeatureNotice
                    feature="el envío de mails"
                    reason="Reenviar la invitación no manda ningún mail: queda registrado en el historial. Se puede reenviar una vez por hora."
                    data-testid="contrato-reenviar-aviso"
                  />
                </footer>
              )}
            </section>
          )}

          {!esFicha && (
            <section className={styles.tarjeta} data-testid="contrato-datos">
              <DetailList title="Datos del contrato" items={datos} />
            </section>
          )}
        </div>

        <div className={styles.columna}>
          {firmaPendienteMia && miRol ? (
            <FirmaContrato
              key={contrato.id}
              contratoId={contrato.id ?? ''}
              titulo={titulo}
              codigo={contrato.code}
              clausulas={contrato.clausulas}
              otraParte={nombreDe(miRol === 'locador' ? locatario : locador)}
              permitirRechazo={miRol === 'locatario'}
              onCambio={alCambiar}
            />
          ) : (
            <section className={styles.tarjeta} aria-labelledby="contrato-documento-titulo" data-testid="contrato-documento-detalle">
              <h2 id="contrato-documento-titulo" className={styles.tarjetaTitulo}>
                Documento
              </h2>
              <VisorContrato titulo={titulo} codigo={contrato.code} clausulas={contrato.clausulas} />
            </section>
          )}

          <section className={styles.tarjeta} aria-labelledby="contrato-historial-titulo" data-testid="contrato-historial">
            <h2 id="contrato-historial-titulo" className={styles.tarjetaTitulo}>
              Historial
            </h2>
            {contrato.historial.length === 0 ? (
              <p className={styles.valorSecundario}>Sin historial registrado: el contrato es anterior a RentAR.</p>
            ) : (
              <ActivityTimeline events={eventosDelHistorial(contrato.historial)} dateFormat="absolute" data-testid="contrato-historial-eventos" />
            )}
          </section>
        </div>
      </div>

      {/* US-07: "mientras ninguna otra parte haya firmado. El contrato vuelve a 'borrador' y se borran las firmas registradas." */}
      <ConfirmActionModal
        open={confirmarCancelar}
        title="¿Cancelar el envío?"
        description={`El contrato vuelve a borrador y se borran las firmas registradas${miFirma?.estado === 'firmado' ? ' (también la tuya)' : ''}. Lo vas a poder editar y volver a enviar.`}
        confirmLabel="Cancelar envío"
        cancelLabel="Volver"
        danger
        confirmLoading={cancelando}
        onConfirm={() => void cancelar()}
        onCancel={() => setConfirmarCancelar(false)}
        data-testid="contrato-cancelar-envio-modal"
      />
    </div>
  )
}

// ─── Carga ──────────────────────────────────────────────────────────────

/** Detalle del contrato: carga, "no encontrado", borrador → `/editar`, y el contenido. */
export function DetalleContrato({ contratoId }: DetalleContratoProps) {
  const router = useRouter()
  const { user } = useAuth()
  const cargar = useCallback(() => getDetalleContrato(contratoId), [contratoId])
  const carga = useServiceCall(cargar)
  const esBorrador = carga.status === 'listo' && carga.data.status === 'borrador'

  // US-07 (decisión del PO): un borrador se sigue editando en el alta.
  useEffect(() => {
    if (esBorrador) router.replace(`/panel/contratos/${encodeURIComponent(contratoId)}/editar`)
  }, [esBorrador, contratoId, router])

  if (carga.status === 'cargando' || esBorrador) {
    return (
      <div className={styles.page} data-testid="contrato-detalle-cargando">
        <PageHeader title="Contrato" breadcrumb={MIGA_BASE} />
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    )
  }

  if (carga.status === 'error') {
    const noEncontrado = carga.code === 'not_found'
    return (
      <div className={styles.page}>
        <PageHeader title="Contrato" breadcrumb={MIGA_BASE} />
        <div className={styles.bloqueado} data-testid={noEncontrado ? 'contrato-no-encontrado' : 'contrato-detalle-error-carga'}>
          <EmptyState
            title={noEncontrado ? 'No encontramos este contrato' : 'No pudimos abrir el contrato'}
            description={noEncontrado ? 'Puede que no exista o que no sea tuyo. Revisá tus contratos.' : carga.message}
            action={
              <span className={styles.acciones}>
                <Button type="primary" onClick={() => router.push('/panel/contratos')} data-testid="contrato-ir-contratos">
                  Ir a Contratos
                </Button>
                {!noEncontrado && (
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
  return (
    <VistaContrato
      key={`${contrato.id}-${contrato.status}`}
      inicial={contrato}
      miRol={rolEnContrato(contrato, user?.id)}
      miga={[...MIGA_BASE, { label: contrato.code ?? 'Contrato' }]}
    />
  )
}
