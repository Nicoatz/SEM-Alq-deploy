'use client'

/**
 * DetalleContrato.tsx — `/panel/contratos/[id]`, el detalle de un contrato.
 *
 * Cubre: US-42 Consultar detalle del contrato, US-06 Modificar y US-07 Firmar
 * contrato de alquiler ("Detalle del contrato", "Firma", "Rechazo y
 * cancelación" y "Contrato vigente"):
 * - Estado de cada firmante (locador, locatario y cada garante: pendiente o
 *   firmado con fecha y hora) y cuántas firmas faltan. Los garantes firman
 *   desde la decisión del PO del 11/11 (se acepta lo que hizo el back).
 * - Datos (US-42): propiedad, partes con DNI, correo y teléfono, garantes,
 *   condiciones, condiciones de cobro y acceso a la solicitud de origen. Lo
 *   que no está registrado dice "Sin dato".
 * - El calendario de ajustes (`CalendarioAjustes`), salvo "Sin ajuste".
 * - El documento paginado (`VisorPdf`) y "Descargar PDF" en cualquier estado.
 *   Con el contrato vigente es el documento firmado, con el aviso de firma de prueba.
 * - US-06: "Modificar" un pendiente sin la firma del locatario, con
 *   confirmación. Es la acción principal del locador para volver atrás; "Rechazar
 *   firma" es la secundaria (D1, PO 11/11), dentro de `FirmaContrato`.
 * - El locador firma acá (`FirmaContrato`): la firma se hace en DocuSign y
 *   vuelve con `?event=` (`useRegresoDeFirma`: "Estamos registrando tu firma…").
 * - Vigente: "Firmado por todas las partes el dd/mm/aaaa"; sin firma ni "Modificar".
 * - Inexistente o ajeno: "No encontramos este contrato", sin distinguir.
 * - Un borrador abierto por esta URL va a `/[id]/editar` (después de un
 *   rechazo, con el aviso `?envio=rechazado`).
 * Ficha del locatario (Mi alquiler, US-27): la misma vista con `vista="locatario"`.
 * Si el contrato vuelve a borrador (rechazó), "ya no está disponible".
 *
 * Qué muestra (Claude Design, "Flujo de contratos" · 04 y 08): la franja de
 * estado arriba, firmantes y datos a la izquierda, documento y calendario a
 * la derecha; en móvil, una sola columna.
 * - Garantes: en la fila de cada garante pendiente, el locador genera su enlace
 *   de firma (`EnlaceGarante`, US-07).
 * NOTA (diseño vs. decisión del PO): el diseño muestra "el link vence el…" en
 * cada garante; acá el vencimiento se ve solo al generar el enlace, porque el
 * detalle no lo informa (TODO(backend), HANDOFF §7). Además, el calendario (US-42).
 *
 * De dónde saca los datos: `contratos.service#getDetalleContrato` (y la
 * función que pase Mi alquiler para volver a pedir la ficha); "Modificar",
 * `#reabrirContrato` (firmar y rechazar, en `FirmaContrato`).
 * Quién lo usa: `app/(app)/panel/contratos/[id]/page.tsx` y `MiAlquiler.tsx`.
 */
import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Skeleton } from 'antd'
import { DownloadOutlined, EditOutlined, LoadingOutlined } from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { ContratoDetalle, EventoFirma, FirmanteContrato, RolFirmante } from '@rentar/shared-types'
import { ConfirmActionModal, DetailList, EmptyState, IndexBadge, MoneyAmount, PageHeader, StatusTag } from '@rentar/ui'
import { MEDIO_PAGO_CORTO } from '@/lib/catalogs/propiedad'
import { fechaCorta, textoPlazo } from '@/lib/contratos/fechas'
import { fechaYHora, firmasQueFaltan, NOMBRE_ROL, puedeModificar } from '@/lib/contratos/firmas'
import { contratosDePropiedadHref, editarContratoHref, MIS_PROPIEDADES_HREF, solicitudesDePropiedadHref } from '@/lib/contratos/rutas'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useRegresoDeFirma, useEventoDeFirma, type FaseRegreso } from '@/lib/hooks/useRegresoDeFirma'
import { useServiceCall } from '@/lib/hooks/useServiceCall'
import { dniParaMostrar, telefonoParaMostrar } from '@/lib/perfil/formato'
import { getDetalleContrato, reabrirContrato, urlPdfDeContrato } from '@/services/contratos.service'
import { ServiceError } from '@/services/shared/errors'
import { AvisoFirmaDePrueba } from './AvisoFirmaDePrueba'
import { BotonPdf } from './BotonPdf'
import { EnlaceGarante } from './EnlaceGarante'
import { MontoAlquiler } from '@/components/cobros/MontoAlquiler'
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

/**
 * Lo que se ve debajo del nombre de cada firmante (US-07: fecha y hora).
 * NOTA: `rechazado` solo puede venir en datos viejos: ahora rechazar vuelve el
 * contrato a borrador y borra todas las firmas.
 */
function estadoDeFirmante(firmante: FirmanteContrato): string {
  const rol = NOMBRE_ROL[firmante.rol]
  if (firmante.estado === 'firmado' && firmante.firmadoEl) return `${rol} · firmó el ${fechaYHora(firmante.firmadoEl)}`
  if (firmante.estado === 'rechazado' && firmante.rechazadoEl) return `${rol} · rechazó la firma el ${fechaYHora(firmante.rechazadoEl)}`
  return `${rol} · todavía no firmó`
}

/** "Cuando firmen…": las dos partes, o también los garantes si los hay. */
function quienesFirman(contrato: ContratoDetalle): string {
  return contrato.firmantes.some((firmante) => firmante.rol === 'garante') ? 'todos (locador, locatario y garantes)' : 'las dos partes'
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

/**
 * El aviso del regreso de DocuSign (US-07; guía del back, §4 y §6). `null` si
 * no hay nada que avisar. Nunca muestra el valor crudo de `?event=`.
 */
function AvisoRegreso({ fase, onActualizar }: { fase: FaseRegreso; onActualizar: () => void }) {
  const actualizar = (
    <Button size="small" onClick={onActualizar} data-testid="contrato-regreso-actualizar">
      Actualizar
    </Button>
  )
  switch (fase.tipo) {
    case 'esperando':
      return <Alert type="info" showIcon icon={<LoadingOutlined />} title="Estamos registrando tu firma…" description="DocuSign tarda unos segundos en avisarnos. No hace falta que hagas nada." data-testid="contrato-regreso-esperando" />
    case 'confirmada':
      return (
        <Alert
          type="success"
          showIcon
          closable={{ 'aria-label': 'Cerrar el aviso' }}
          title={fase.vigente ? 'Firmaste el contrato. Firmaron todos: el contrato está vigente y la propiedad pasó a alquilada.' : 'Firmaste el contrato.'}
          data-testid="contrato-regreso-confirmado"
        />
      )
    case 'demorada':
      return <Alert type="warning" showIcon title="Todavía estamos registrando tu firma. Actualizá en unos minutos." action={actualizar} data-testid="contrato-regreso-demorado" />
    case 'esperando_rechazo':
      return <Alert type="info" showIcon icon={<LoadingOutlined />} title="Estamos registrando el rechazo…" description="El contrato vuelve a borrador en unos segundos." data-testid="contrato-regreso-rechazo-esperando" />
    case 'rechazo_demorado':
      return <Alert type="warning" showIcon title="Todavía estamos registrando el rechazo. Actualizá en unos minutos." action={actualizar} data-testid="contrato-regreso-rechazo-demorado" />
    case 'sin_firma':
      return <Alert type="warning" showIcon closable={{ 'aria-label': 'Cerrar el aviso' }} title={fase.mensaje} data-testid="contrato-regreso-sin-firma" />
    default:
      return null
  }
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
  /** El `?event=` con que se volvió de DocuSign (US-07), o `null`. */
  evento: EventoFirma | null
  /** Vuelve a pedir el contrato, para la espera después de firmar. */
  recargar: () => Promise<ContratoDetalle>
}

/**
 * El contrato cargado, con lo que le toca a cada parte: firmar en DocuSign y
 * rechazar (las dos partes, mientras no hayan firmado) y modificar (el
 * locador). La usan el detalle del locador y Mi alquiler (`MiAlquiler.tsx`).
 */
export function VistaContrato({ inicial, miRol, miga, titulo: tituloPagina, vista = 'locador', evento, recargar }: VistaContratoProps) {
  const router = useRouter()

  // ─── Estado local ───────────────────────────────────────────────────
  const [contrato, setContrato] = useState<ContratoDetalle>(inicial)
  const [errorAccion, setErrorAccion] = useState<string | null>(null)
  const [confirmarModificar, setConfirmarModificar] = useState(false)
  const [reabriendo, setReabriendo] = useState(false)
  /** El locatario rechazó (o el contrato volvió a borrador): ya no lo puede ver. */
  const [yaNoDisponible, setYaNoDisponible] = useState(false)

  const { locador, locatario, condiciones, propiedad } = contrato
  const contratoId = contrato.id ?? ''
  const esFicha = vista === 'locatario'
  const obtenerPdf = useCallback(() => urlPdfDeContrato(contratoId, esFicha ? 'locatario' : 'locador'), [contratoId, esFicha])
  const pendiente = contrato.status === 'pendiente_firma'
  const soyLocador = miRol === 'locador'
  const faltan = firmasQueFaltan(contrato.firmantes)
  const modificable = puedeModificar(contrato)

  // ─── Handlers ───────────────────────────────────────────────────────
  /**
   * El contrato volvió a borrador (rechazó quien mira u otra parte). El locador
   * sigue en el alta, con el aviso; para el locatario un borrador no existe.
   */
  function alVolverABorrador(): void {
    if (soyLocador) router.replace(`${editarContratoHref(contratoId)}?envio=rechazado`)
    else setYaNoDisponible(true)
  }

  const { fase, actualizar } = useRegresoDeFirma({
    evento,
    inicial,
    rol: miRol,
    consultar: recargar,
    onDatos: setContrato,
    onYaNoEsta: alVolverABorrador,
  })

  /**
   * US-06: "Al confirmar, el contrato vuelve a 'borrador' y conserva su código".
   * Se sigue editando en el alta.
   */
  async function modificar(): Promise<void> {
    setReabriendo(true)
    setErrorAccion(null)
    try {
      await reabrirContrato(contratoId)
      setConfirmarModificar(false)
      router.replace(`${editarContratoHref(contratoId)}?envio=cancelado`)
    } catch (error) {
      setConfirmarModificar(false)
      // Ya estaba en borrador (otra pestaña u otro dispositivo): no es un error, se sigue editando.
      if (error instanceof ServiceError && error.apiCode === 'CONTRATO_YA_EN_BORRADOR') {
        router.replace(editarContratoHref(contratoId))
        return
      }
      setErrorAccion(error instanceof ServiceError ? error.message : 'No pudimos reabrir el contrato. Probá de nuevo.')
      setReabriendo(false)
    }
  }

  // ─── Render: ya no disponible (locatario, después de un rechazo) ────
  if (yaNoDisponible) {
    return <ContratoYaNoDisponible miga={miga} titulo={tituloPagina ?? 'Mi alquiler'} rechazoPropio={evento === 'decline' || fase.tipo !== 'ya_no_esta'} />
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
  // Mientras se espera el aviso de DocuSign no se ofrece firmar de nuevo.
  const esperandoAviso = fase.tipo === 'esperando' || fase.tipo === 'demorada' || fase.tipo === 'esperando_rechazo' || fase.tipo === 'rechazo_demorado'
  // Sin PDF, el botón queda deshabilitado. La URL se pide al usarla (S4-13).
  const tienePdf = Boolean(datosApi?.pdfUrl ?? contrato.pdf)
  const mostrarFirma = (miRol === 'locador' || miRol === 'locatario') && pendiente && contrato.puedoFirmar && tienePdf && !esperandoAviso
  // US-07 (guía del back, §5): con el contrato vigente, el documento es el firmado en DocuSign.
  const documentoFirmado = (contrato.status === 'vigente' || contrato.status === 'finalizado') && contrato.firmasRegistradas
  const nombrePdf = contrato.pdf?.nombre ?? (documentoFirmado && contrato.code ? `${contrato.code}-firmado.pdf` : undefined)
  const botonPdf = tienePdf ? (
    <BotonPdf obtenerUrl={obtenerPdf} icon={<DownloadOutlined />} data-testid="contrato-descargar-pdf">
      Descargar PDF
    </BotonPdf>
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

      <AvisoRegreso fase={fase} onActualizar={actualizar} />
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
            Cuando firmen {quienesFirman(contrato)}, el contrato pasa a vigente y la propiedad, a alquilada.
          </span>
          {/* US-06: se modifica mientras el locatario no haya firmado; si firmó, se explica el motivo. */}
          {soyLocador && !esFicha && (
            <span className={styles.franjaAccion}>
              <Button icon={<EditOutlined />} disabled={!modificable} onClick={() => setConfirmarModificar(true)} data-testid="contrato-modificar">
                Modificar
              </Button>
              {!modificable && (
                <span className={styles.motivo} data-testid="contrato-modificar-motivo">
                  {locatario.nombre || 'El locatario'} ya firmó: el contrato no se puede modificar.
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
          {esFicha && contrato.status === 'vigente' && contrato.id && <MontoAlquiler contratoId={contrato.id} />}
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
                {contrato.firmantes.map((firmante) => (
                  <li
                    key={firmante.key}
                    className={styles.firmante}
                    data-testid="contrato-firmante"
                    data-rol={firmante.rol}
                    data-garante={firmante.rol === 'garante' ? firmante.key.replace('garante-', '') : undefined}
                    data-estado={firmante.estado}
                  >
                    <span className={styles.avatar} data-estado={firmante.estado} aria-hidden>
                      {iniciales(firmante.nombre)}
                    </span>
                    <span className={styles.firmanteDatos}>
                      <span className={styles.firmanteNombre}>{firmante.nombre}</span>
                      <span className={styles.valorSecundario} data-testid="contrato-firmante-detalle">
                        {estadoDeFirmante(firmante)}
                      </span>
                    </span>
                    <StatusTag domain="firma" status={firmante.estado} data-testid="contrato-firmante-estado" />
                    {/* US-07: el locador le genera el enlace a cada garante que todavía no firmó. */}
                    {soyLocador && !esFicha && pendiente && firmante.rol === 'garante' && firmante.estado === 'pendiente' && firmante.garanteId && (
                      <EnlaceGarante contratoId={contratoId} garanteId={firmante.garanteId} nombre={firmante.nombre} />
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {!esFicha && (
            <section className={styles.tarjeta} data-testid="contrato-datos">
              <DetailList title="Datos del contrato" items={datos} />
            </section>
          )}
        </div>

        <div className={styles.columna}>
          {mostrarFirma && (miRol === 'locador' || miRol === 'locatario') ? (
            <FirmaContrato
              key={contrato.id}
              contratoId={contratoId}
              obtenerPdf={obtenerPdf}
              nombrePdf={nombrePdf}
              miRol={miRol}
              cantidadFirmantes={contrato.firmantes.length}
              onRechazado={alVolverABorrador}
            />
          ) : (
            <section className={styles.tarjeta} aria-labelledby="contrato-documento-titulo" data-testid="contrato-documento-detalle">
              <h2 id="contrato-documento-titulo" className={styles.tarjetaTitulo}>
                {documentoFirmado ? 'Documento firmado' : 'Documento'}
              </h2>
              {documentoFirmado && <AvisoFirmaDePrueba data-testid="contrato-documento-aviso-prueba" />}
              {tienePdf ? (
                <VisorPdf obtenerUrl={obtenerPdf} nombre={nombrePdf} data-testid="contrato-visor" />
              ) : (
                <p className={styles.valorSecundario} data-testid="mi-alquiler-documento-pdf">
                  Sin dato: el contrato todavía no tiene un PDF cargado.
                </p>
              )}
            </section>
          )}

          {/* US-11: en la ficha del locatario, solo para contratos vigentes. */}
          {(!esFicha || contrato.status === 'vigente') && (
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
    </div>
  )
}

/** Props de {@link ContratoYaNoDisponible}. */
interface ContratoYaNoDisponibleProps {
  miga: { label: string; href?: string }[]
  titulo: string
  /** `true` si lo rechazó quien mira; `false` si lo rechazó otra parte mientras esperaba su firma. */
  rechazoPropio: boolean
}

/**
 * Mi alquiler después de un rechazo (US-07): el contrato volvió a borrador y el
 * locatario ya no lo ve. No es un error: "ya no está disponible".
 */
export function ContratoYaNoDisponible({ miga, titulo, rechazoPropio }: ContratoYaNoDisponibleProps) {
  const router = useRouter()
  return (
    <div className={styles.page}>
      <PageHeader title={titulo} breadcrumb={miga} />
      <div className={styles.bloqueado} data-testid="mi-alquiler-no-disponible">
        <EmptyState
          title={rechazoPropio ? 'Rechazaste el contrato' : 'Este contrato ya no está disponible'}
          description={
            rechazoPropio
              ? 'Volvió a borrador y ya no está disponible. Si el locador lo corrige, te lo va a volver a enviar para firmar.'
              : 'Se rechazó la firma y el contrato volvió a borrador. Si el locador lo corrige, te lo va a volver a enviar para firmar.'
          }
          action={
            <Button type="primary" onClick={() => router.push('/panel/alquiler')} data-testid="mi-alquiler-ir">
              Ir a Mi alquiler
            </Button>
          }
        />
      </div>
    </div>
  )
}

// ─── Carga ──────────────────────────────────────────────────────────────

/** Detalle del contrato: carga, "no encontrado", borrador → `/editar`, y el contenido. */
export function DetalleContrato({ contratoId }: DetalleContratoProps) {
  const router = useRouter()
  const { user } = useAuth()
  const evento = useEventoDeFirma()
  const cargar = useCallback(() => getDetalleContrato(contratoId), [contratoId])
  const carga = useServiceCall(cargar)
  // US-42: "Un borrador no tiene detalle: al abrirlo se retoma en el alta". En real llega como 409.
  const esBorrador = (carga.status === 'listo' && carga.data.status === 'borrador') || (carga.status === 'error' && carga.apiCode === 'CONTRATO_BORRADOR')

  useEffect(() => {
    // US-07: si volvió de DocuSign con `decline` y el rechazo ya se registró, el alta lo avisa.
    if (esBorrador) router.replace(evento === 'decline' ? `${editarContratoHref(contratoId)}?envio=rechazado` : editarContratoHref(contratoId))
  }, [esBorrador, evento, contratoId, router])

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
      evento={evento}
      recargar={cargar}
    />
  )
}
