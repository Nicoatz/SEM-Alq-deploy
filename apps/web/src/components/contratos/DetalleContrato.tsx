'use client'

/**
 * DetalleContrato.tsx — `/panel/contratos/[id]`, el detalle de un contrato.
 *
 * Cubre: US-42 Consultar detalle del contrato y US-07 Firmar contrato de
 * alquiler ("Detalle del contrato", "Rechazo y cancelación" y "Contrato vigente"):
 * - Estado de cada firmante (pendiente / firmado con fecha y hora /
 *   rechazado con el motivo) y cuántas firmas faltan.
 * - Datos (US-42): propiedad, partes con DNI, correo y teléfono, garantes,
 *   condiciones, condiciones de cobro y acceso a la solicitud de origen. Lo
 *   que no está registrado dice "Sin dato".
 * - El calendario de ajustes (`CalendarioAjustes`), salvo "Sin ajuste".
 * - El documento paginado (`VisorPdf`) y "Descargar PDF" en cualquier estado.
 * - US-06: "Modificar" un pendiente sin la firma del locatario, con confirmación.
 * - Se entra desde la pestaña Contratos de la propiedad (US-43); la miga vuelve ahí.
 * Decisión del PO: sin historial ni registro de IP (salieron de US-07 y US-42).
 * - El locador firma acá (`FirmaContrato`), cancela el envío (si el
 *   locatario no firmó) y reenvía la invitación (una vez por hora).
 * - Vigente: "Firmado por todas las partes el dd/mm/aaaa"; sin firma,
 *   reenvío ni cancelación.
 * - Inexistente o ajeno: "No encontramos este contrato", sin distinguir.
 * - Un borrador abierto por esta URL va a `/[id]/editar`.
 * Decisión del PO (Sprint 3): firman el locador y el locatario; los garantes
 * se muestran como datos, sin estado de firma.
 * Ficha del locatario en modo real (`contrato.datosApi`, US-27): decisiones
 * del PO para la conexión de `/alquileres-locatario`:
 * - Sin "Firmar contrato" ni "Rechazar" (aunque el back diga `puede_firmar`):
 *   un aviso "La firma todavía no está disponible en línea". TODO(backend): US-07.
 * - "Descargar PDF" baja el PDF del back (`pdfUrl`); sin él, deshabilitado.
 * - Sin cláusulas (el back no las manda): se dice, no se inventan.
 * Detalle del locador en modo real (`GET /contratos/:id/detalle`, US-42): usa
 * el mismo `datosApi`: sin firma, cancelación ni reenvío en línea hasta que
 * se conecten (TODO(backend): US-07). "Modificar" sí: `reabrir` existe.
 *
 * Qué muestra (Claude Design, "Flujo de contratos" · 04 y 08): la franja de
 * estado arriba, firmantes y datos a la izquierda, documento y calendario a
 * la derecha; en móvil, una sola columna.
 * NOTA (diseño vs. decisión del PO): el diseño muestra tres firmas (con el
 * garante) y "el link vence el…", y ya no tiene el calendario. Acá: dos
 * firmas, sin vencimiento de links (no hay mails) y con calendario (US-42).
 *
 * De dónde saca los datos: `contratos.service#getDetalleContrato`; las
 * acciones, `#cancelarEnvio` y `#reenviarInvitacion` (firmar y rechazar, en
 * `FirmaContrato`).
 * Quién lo usa: `app/(app)/panel/contratos/[id]/page.tsx`.
 */
import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Skeleton } from 'antd'
import { DownloadOutlined, EditOutlined, MailOutlined, RollbackOutlined } from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { ContratoDetalle, FirmanteContrato, RolFirmante } from '@rentar/shared-types'
import { ConfirmActionModal, DetailList, EmptyState, IndexBadge, MoneyAmount, PageHeader, SimulatedFeatureNotice, StatusTag } from '@rentar/ui'
import { MEDIO_PAGO_CORTO } from '@/lib/catalogs/propiedad'
import { fechaCorta, textoPlazo } from '@/lib/contratos/fechas'
import { fechaYHora, firmasQueFaltan, motivoSinReenvio, NOMBRE_ROL, puedeCancelarEnvio } from '@/lib/contratos/firmas'
import { tituloContrato } from '@/lib/contratos/plantilla'
import { contratosDePropiedadHref, editarContratoHref, MIS_PROPIEDADES_HREF, solicitudesDePropiedadHref } from '@/lib/contratos/rutas'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useServiceCall } from '@/lib/hooks/useServiceCall'
import { dniParaMostrar, telefonoParaMostrar } from '@/lib/perfil/formato'
import { ahoraIso } from '@/lib/utils/fechas'
import { cancelarEnvio, getDetalleContrato, reabrirContrato, reenviarInvitacion } from '@/services/contratos.service'
import { ServiceError } from '@/services/shared/errors'
import { CalendarioAjustes } from './CalendarioAjustes'
import { CondicionesAlquiler, EncabezadoAlquiler, LocadorAlquiler, LoQueVieneAlquiler } from './FichaAlquiler'
import { FirmaContrato } from './FirmaContrato'
import { VisorPdf } from './VisorPdf'
import styles from './DetalleContrato.module.css'

const MIGA_BASE = [{ label: 'Mis propiedades', href: MIS_PROPIEDADES_HREF }]

/** Miga (decisión del PO): Mis propiedades › [dirección] › Contrato [código]. La dirección vuelve a la pestaña Contratos. */
function migaDeContrato(contrato: ContratoDetalle) {
  return [...MIGA_BASE, { label: contrato.propiedad.address, href: contratosDePropiedadHref(contrato.propiedad.id) }, { label: `Contrato ${contrato.code ?? ''}`.trim() }]
}

/** Props de {@link DetalleContrato}. */
interface DetalleContratoProps {
  contratoId: string
}

/** "Nombre Apellido" de una parte. */
function nombreDe(parte: ContratoDetalle['locador']): string {
  return `${parte.nombre} ${parte.apellido}`.trim()
}

/** US-42: "las condiciones de cobro de la propiedad": medios, días de gracia e interés. */
function condicionesDeCobro({ paymentMethods, graceDays, dailyInterestPct }: ContratoDetalle['propiedad']['cobro']): string {
  const partes = [
    ...(paymentMethods.length > 0 ? [paymentMethods.map((medio) => MEDIO_PAGO_CORTO[medio.method]).join(', ')] : []),
    ...(graceDays === null ? [] : [`${graceDays} ${graceDays === 1 ? 'día' : 'días'} de gracia`]),
    ...(dailyInterestPct === null ? [] : [`${String(dailyInterestPct).replace('.', ',')} % de interés por día`]),
  ]
  return partes.length > 0 ? partes.join(' · ') : 'Sin dato'
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
  const [confirmarModificar, setConfirmarModificar] = useState(false)
  const [reabriendo, setReabriendo] = useState(false)
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

  /**
   * US-06: "Al confirmar, el contrato vuelve a 'borrador' y conserva su código".
   * Se sigue editando en el alta.
   */
  async function modificar(): Promise<void> {
    setReabriendo(true)
    setErrorAccion(null)
    try {
      await reabrirContrato(contrato.id ?? '')
      setConfirmarModificar(false)
      router.replace(`${editarContratoHref(contrato.id ?? '')}?envio=cancelado`)
    } catch (error) {
      setErrorAccion(error instanceof ServiceError ? error.message : 'No pudimos reabrir el contrato. Probá de nuevo.')
      setConfirmarModificar(false)
      setReabriendo(false)
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
      setAviso(`Le reenviaste la invitación a ${firmante?.nombre ?? NOMBRE_ROL[rol]} (no se mandó ningún mail).`)
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
  /** US-42: "nombre, apellido, DNI, correo y teléfono"; lo que falta dice "Sin dato". */
  const parte = (persona: ContratoDetalle['locador']) =>
    nombreDe(persona) ? (
      <span className={styles.valorCompuesto}>
        <span>{nombreDe(persona)}</span>
        <span className={styles.valorSecundario}>DNI {persona.dni ? dniParaMostrar(persona.dni) : 'Sin dato'}</span>
        <span className={styles.valorSecundario}>{persona.email || 'Correo: Sin dato'}</span>
        <span className={styles.valorSecundario}>{persona.telefono ? telefonoParaMostrar(persona.telefono) : 'Teléfono: Sin dato'}</span>
      </span>
    ) : (
      'Sin dato'
    )
  const datos = [
    { label: 'Propiedad', value: `${propiedad.address}${propiedad.neighborhoodName ? ` · ${propiedad.neighborhoodName}` : ''}` },
    { label: 'Locador', value: parte(locador) },
    { label: 'Locatario', value: parte(locatario) },
    {
      label: contrato.garantes.length === 1 ? 'Garante' : 'Garantes',
      value:
        contrato.garantes.length === 0 ? (
          contrato.firmasRegistradas ? 'Sin garantes' : 'Sin dato'
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
    { label: 'Monto actual', value: contrato.montoActual === null ? 'Sin dato' : <MoneyAmount amount={contrato.montoActual} /> },
    { label: 'Depósito', value: condiciones.deposit === null ? 'Sin dato' : <MoneyAmount amount={condiciones.deposit} /> },
    {
      label: 'Ajuste',
      value: (
        <span className={styles.ajuste}>
          <IndexBadge index={condiciones.adjustmentIndex} />
          {condiciones.adjustmentIndex !== 'sin_ajuste' && contrato.ajusteCadaMeses ? `cada ${contrato.ajusteCadaMeses} meses` : null}
        </span>
      ),
    },
    {
      label: 'Vencimiento del pago',
      value: condiciones.paymentTermDays === null ? 'Sin dato' : textoPlazo(condiciones.paymentTermDays),
    },
    { label: 'Condiciones de cobro', value: condicionesDeCobro(propiedad.cobro) },
    {
      label: 'Solicitud de origen',
      value: contrato.solicitudId ? (
        <Link href={solicitudesDePropiedadHref(propiedad.id)} data-testid="contrato-detalle-solicitud">
          Ver solicitudes de la propiedad
        </Link>
      ) : (
        'Sin dato'
      ),
    },
  ]

  // ─── Render ─────────────────────────────────────────────────────────
  const { datosApi } = contrato
  // Decisión del PO: en real no hay firma en línea (US-07 no existe en la API).
  const firmaEnLinea = datosApi === null
  // Cancelar el envío y reenviar, igual: en real no hay acciones de US-07 conectadas (Tanda 3).
  const accionesDeLocador = soyLocador && firmaEnLinea
  const firmaPendienteMia = pendiente && miFirma?.estado === 'pendiente'
  const esFicha = vista === 'locatario'
  // El PDF del contrato; en la ficha del locatario lo manda `datosApi`. Sin él, el botón queda deshabilitado.
  const pdfUrl = datosApi?.pdfUrl ?? contrato.pdf?.url ?? null
  const botonPdf = pdfUrl ? (
    <Button icon={<DownloadOutlined />} href={pdfUrl} target="_blank" rel="noopener noreferrer" data-testid="contrato-descargar-pdf">
      Descargar PDF
    </Button>
  ) : (
    <span className={styles.franjaAccion}>
      <Button icon={<DownloadOutlined />} disabled data-testid="contrato-descargar-pdf">
        Descargar PDF
      </Button>
      <span className={styles.motivo} data-testid="contrato-pdf-no-disponible">
        El PDF todavía no está disponible
      </span>
    </span>
  )
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
        actions={botonPdf}
      />

      {aviso && <Alert type="success" showIcon closable={{ 'aria-label': 'Cerrar el aviso' }} onClose={() => setAviso(null)} title={aviso} data-testid="contrato-detalle-aviso" />}
      {errorAccion && <Alert type="error" showIcon closable={{ 'aria-label': 'Cerrar el error' }} onClose={() => setErrorAccion(null)} title={errorAccion} data-testid="contrato-detalle-error" />}

      {esFicha && <EncabezadoAlquiler contrato={contrato} />}

      {/* Franja de estado (Claude Design · 05): lo primero mientras faltan firmas. */}
      {pendiente ? (
        <div className={`${styles.franja} ${styles.franjaPendiente}`} data-testid="contrato-estado">
          {!esFicha && <StatusTag domain="contrato" status="pendiente_firma" />}
          <span className={styles.franjaTexto}>
            {contrato.firmasRegistradas ? (
              <span data-testid="contrato-faltan-firmas">
                {faltan === 1 ? 'Falta' : 'Faltan'} <strong>{faltan} de {contrato.firmantes.length} firmas</strong>.
                {contrato.enviadoEl ? ` Enviado el ${fechaCorta(contrato.enviadoEl)}.` : ''}
              </span>
            ) : (
              // En real, firmas en `desconocido` (anteriores a la migración de US-27): no se inventa cuántas faltan.
              <span data-testid="contrato-firmas-sin-registro">Todavía no hay registro del estado de cada firma.</span>
            )}{' '}
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
          {/* US-06: se modifica mientras el locatario no haya firmado; si firmó, se explica el motivo. */}
          {soyLocador && !esFicha && (
            <span className={styles.franjaAccion}>
              <Button icon={<EditOutlined />} disabled={!cancelable} onClick={() => setConfirmarModificar(true)} data-testid="contrato-modificar">
                Modificar
              </Button>
              {!cancelable && (
                <span className={styles.motivo} data-testid="contrato-modificar-motivo">
                  {locatario.nombre || 'El locatario'} ya firmó: el contrato no se puede modificar.
                </span>
              )}
            </span>
          )}
          {accionesDeLocador && (
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
          {!esFicha && <StatusTag domain="contrato" status="vigente" />}
          <span className={styles.franjaTexto} data-testid="contrato-firmado-todas">
            Firmado por todas las partes el {fechaCorta(contrato.firmadoPorTodasEl)}.
          </span>
        </div>
      ) : (
        <div className={styles.franja} data-testid="contrato-estado">
          {!esFicha && <StatusTag domain="contrato" status={contrato.status} />}
          {!contrato.firmasRegistradas && (
            <span className={styles.franjaTexto} data-testid="contrato-sin-registro">
              {datosApi ? 'Todavía no hay registro del estado de cada firma.' : 'Contrato anterior a RentAR: no hay registro de las firmas.'}
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
                  const reenviable = accionesDeLocador && pendiente && firmante.rol !== 'locador'
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
              {accionesDeLocador && pendiente && (
                <footer className={styles.tarjetaPie}>
                  <SimulatedFeatureNotice
                    feature="el envío de mails"
                    reason="Reenviar la invitación no manda ningún mail. Se puede reenviar una vez por hora."
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
          {firmaPendienteMia && miRol && firmaEnLinea ? (
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
              {datosApi && pendiente && (
                // Decisión del PO: sin botones de firma en real. TODO(backend): firmar y rechazar (US-07) no existen en la API.
                <Alert type="info" showIcon title="La firma todavía no está disponible en línea." data-testid="mi-alquiler-firma-no-disponible" />
              )}
              {pdfUrl ? (
                <VisorPdf url={pdfUrl} nombre={contrato.pdf?.nombre} data-testid="contrato-visor" />
              ) : (
                <p className={styles.valorSecundario} data-testid="mi-alquiler-documento-pdf">
                  Sin dato: el contrato todavía no tiene un PDF cargado.
                </p>
              )}
            </section>
          )}

          {!esFicha && (
            <CalendarioAjustes inicio={condiciones.startDate} fin={contrato.endDate} cadaMeses={contrato.ajusteCadaMeses} indice={condiciones.adjustmentIndex} montoInicial={condiciones.initialAmount} />
          )}
        </div>
      </div>

      {/* US-06: "se debe solicitar confirmación avisando que el envío se cancela, que se borran las firmas registradas y que el contrato vuelve a 'borrador'". */}
      <ConfirmActionModal
        open={confirmarModificar}
        title="¿Modificar el contrato?"
        description="Se cancela el envío, se borran las firmas registradas y el contrato vuelve a borrador, con el mismo código. Después lo vas a tener que enviar a firmar de nuevo."
        confirmLabel="Modificar contrato"
        cancelLabel="Volver"
        danger
        confirmLoading={reabriendo}
        onConfirm={() => void modificar()}
        onCancel={() => setConfirmarModificar(false)}
        data-testid="contrato-modificar-modal"
      />

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
  // US-42: "Un borrador no tiene detalle: al abrirlo se retoma en el alta". En real llega como 409.
  const esBorrador = (carga.status === 'listo' && carga.data.status === 'borrador') || (carga.status === 'error' && carga.apiCode === 'CONTRATO_BORRADOR')

  useEffect(() => {
    if (esBorrador) router.replace(editarContratoHref(contratoId))
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
            description={noEncontrado ? 'Puede que no exista o que no sea tuyo. Revisá tus propiedades.' : carga.message}
            action={
              <span className={styles.acciones}>
                <Button type="primary" onClick={() => router.push(MIS_PROPIEDADES_HREF)} data-testid="contrato-ir-propiedades">
                  Ir a mis propiedades
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
      miga={migaDeContrato(contrato)}
    />
  )
}
