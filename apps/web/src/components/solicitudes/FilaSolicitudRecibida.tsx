'use client'

/**
 * FilaSolicitudRecibida.tsx — una solicitud en la lista del locador, y los
 * botones de acción que comparte con el detalle del postulante.
 *
 * Qué muestra (Claude Design, "Flujo de solicitudes" · 02): avatar con
 * iniciales, nombre y apellido del postulante (US-36), `StatusTag` del
 * dominio `solicitud`, cuándo llegó ("hace 3 h", "hace 2 días") o cuándo se
 * respondió, el resumen de la solicitud (US-36: convivientes, mascotas,
 * garantías y si declaró ingresos, nunca el monto), un extracto de 2 líneas
 * del mensaje (P3/P6 del testing: el completo va en el detalle), la línea
 * que explica el estado, y las acciones según el estado
 * (`TRANSICIONES_SOLICITUD`):
 * - Pendiente: Aceptar y Rechazar (US-37: "distinguir claramente el botón
 *   de aceptar y el de rechazar": azul lleno con ✓ y blanco con ✕). Si la
 *   propiedad ya tiene una aceptada, Aceptar queda deshabilitado con el
 *   motivo en un tooltip (una sola aceptada por propiedad).
 * - Aceptada: "Iniciar contrato" (US-05, Sprint 3), o "Continuar contrato" si
 *   ya hay un borrador; si ya originó un contrato o la propiedad tiene otro
 *   vigente o pendiente de firma, el motivo en lugar del botón. Además,
 *   Cancelar solicitud (US-38), si el back lo permite.
 * - Rechazada o cancelada: Ver detalle.
 * Si la rechazó con un motivo (US-37), va debajo de la línea, truncado a 80
 * caracteres (US-36); el completo está en el detalle del postulante.
 * Las acciones de la fila (y "Ver detalle") van solo en móvil (`conAcciones`):
 * en escritorio no entran al lado del resumen (medido a 1280 px en la tanda C)
 * y están en el detalle del costado, con los `data-testid` `solicitudes-detalle-*`.
 * NOTA: "Mensaje" de la aceptada no va: los mensajes son de otro sprint.
 *
 * Quién lo usa: `GrupoPropiedad` (la fila) y `DetallePostulante` (las acciones).
 */
import type { MouseEvent } from 'react'
import { Avatar, Button, Tooltip } from 'antd'
import { CheckOutlined, CloseOutlined, FileAddOutlined, StopOutlined } from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import type { Solicitud } from '@rentar/shared-types'
import { StatusTag } from '@rentar/ui'
import { fechaFilaRecibida, lineaRecibida, textoResumen } from '@/lib/solicitudes/textos'
import { iniciales } from '@/lib/utils/iniciales'
import { MENSAJE_RECHAZO_LISTADO_MAX, truncar } from '@/lib/utils/truncar'
import { puedeHacerAccion, textoYaAceptaste, type AccionSolicitud } from '@/lib/validation/solicitud.rules'
import { puedeCancelarAceptada } from '@/services/solicitudes.service'
import styles from './SolicitudesRecibidas.module.css'

// ─── Acciones ───────────────────────────────────────────────────────────

/** Props de {@link AccionContrato}. */
interface AccionContratoProps {
  solicitud: Solicitud
  largo: boolean
  testIdPrefix: string
}

/**
 * "Iniciar contrato" de una solicitud aceptada (US-05: "se debe poder iniciar
 * el contrato desde una solicitud aceptada"). Solo aparece si la solicitud no
 * originó ya un contrato y la propiedad no tiene otro vigente ni pendiente de
 * firma. Con un borrador de esta solicitud: "Continuar contrato". Si no se
 * puede, el motivo en lugar del botón.
 * NOTA: en real, `contrato` y `propiedadConContrato` no llegan todavía
 * (TODO(backend) en `solicitud.adapter.ts`): el botón aparece y, si no
 * corresponde, lo frena `/contratos/preparar` con su 409.
 */
function AccionContrato({ solicitud, largo, testIdPrefix }: AccionContratoProps) {
  const router = useRouter()
  const { contrato } = solicitud

  /** Navega sin abrir además el detalle de la fila. */
  function ir(href: string) {
    return (event: MouseEvent) => {
      event.stopPropagation()
      router.push(href)
    }
  }

  if (contrato && contrato.status !== 'borrador') {
    return (
      <span className={styles.contratoNota} data-testid={`${testIdPrefix}-contrato-estado`}>
        Ya originó un contrato <StatusTag domain="contrato" status={contrato.status} />
        {/* US-07: el detalle del contrato, con sus firmas. */}
        <Button type="link" size="small" onClick={ir(`/panel/contratos/${encodeURIComponent(contrato.id)}`)} data-testid={`${testIdPrefix}-ver-contrato`}>
          Ver contrato
        </Button>
      </span>
    )
  }
  if (contrato) {
    return (
      <Button
        type="primary"
        size={largo ? 'large' : 'middle'}
        icon={<FileAddOutlined />}
        onClick={ir(`/panel/contratos/${encodeURIComponent(contrato.id)}/editar`)}
        className={styles.actionButton}
        data-testid={`${testIdPrefix}-continuar-contrato-button`}
      >
        Continuar contrato
      </Button>
    )
  }
  if (solicitud.propiedadConContrato) {
    return (
      <span className={styles.contratoNota} data-testid={`${testIdPrefix}-contrato-bloqueado`}>
        La propiedad ya tiene un contrato vigente o pendiente de firma.
      </span>
    )
  }
  return (
    <Button
      type="primary"
      size={largo ? 'large' : 'middle'}
      icon={<FileAddOutlined />}
      onClick={ir(`/panel/contratos/nuevo?solicitud=${encodeURIComponent(solicitud.id)}`)}
      className={styles.actionButton}
      aria-label={`Iniciar el contrato con ${solicitud.applicant.fullName}`}
      data-testid={`${testIdPrefix}-iniciar-contrato-button`}
    >
      Iniciar contrato
    </Button>
  )
}

/** Props de {@link AccionesSolicitudRecibida}. */
interface AccionesSolicitudRecibidaProps {
  solicitud: Solicitud
  /** La aceptada de la misma propiedad, si es otra: deshabilita "Aceptar". */
  otraAceptada: Solicitud | undefined
  onAccion: (accion: AccionSolicitud, solicitud: Solicitud) => void
  /** `fila`: botones compactos; `detalle`: ocupan el ancho, con textos largos. */
  variante: 'fila' | 'detalle'
  /** Prefijo de los `data-testid`: `solicitudes` (fila) o `solicitudes-detalle`. */
  testIdPrefix: string
}

/**
 * Los botones de una solicitud recibida, según su estado. Devuelve `null` si
 * no hay ninguna acción posible (rechazada o cancelada).
 */
export function AccionesSolicitudRecibida({ solicitud, otraAceptada, onAccion, variante, testIdPrefix }: AccionesSolicitudRecibidaProps) {
  const largo = variante === 'detalle'
  const clase = largo ? styles.actionsDetail : styles.actions

  /** Que el click en un botón no abra además el detalle de la fila. */
  function accion(tipo: AccionSolicitud) {
    return (event: MouseEvent) => {
      event.stopPropagation()
      onAccion(tipo, solicitud)
    }
  }

  if (puedeHacerAccion('aceptar', 'locador', solicitud.status)) {
    const bloqueada = otraAceptada !== undefined
    const aceptar = (
      <Button
        type="primary"
        size={largo ? 'large' : 'middle'}
        icon={<CheckOutlined />}
        disabled={bloqueada}
        onClick={accion('aceptar')}
        className={styles.actionButton}
        aria-label={`Aceptar la solicitud de ${solicitud.applicant.fullName}`}
        data-testid={`${testIdPrefix}-aceptar-button`}
      >
        {largo ? 'Aceptar solicitud' : 'Aceptar'}
      </Button>
    )
    return (
      <div className={clase}>
        {bloqueada ? (
          // Una sola aceptada por propiedad: el motivo, en vez de un botón que no hace nada.
          <Tooltip title={textoYaAceptaste(otraAceptada.applicant.fullName, puedeCancelarAceptada)}>
            <span className={styles.tooltipWrap} data-testid={`${testIdPrefix}-aceptar-bloqueado`}>
              {aceptar}
            </span>
          </Tooltip>
        ) : (
          aceptar
        )}
        <Button
          size={largo ? 'large' : 'middle'}
          icon={<CloseOutlined />}
          onClick={accion('rechazar')}
          className={styles.actionButton}
          aria-label={`Rechazar la solicitud de ${solicitud.applicant.fullName}`}
          data-testid={`${testIdPrefix}-rechazar-button`}
        >
          Rechazar
        </Button>
      </div>
    )
  }

  if (solicitud.status === 'aceptada') {
    // US-38: "Cancelar solicitud" solo si el back deja dar de baja una aceptada
    // (en real, todavía no: brecha 1 de HANDOFF §7).
    const cancelable = puedeCancelarAceptada && puedeHacerAccion('cancelar', 'locador', solicitud.status)
    return (
      <div className={clase}>
        <AccionContrato solicitud={solicitud} largo={largo} testIdPrefix={testIdPrefix} />
        {cancelable && (
          <Button
            size={largo ? 'large' : 'middle'}
            icon={<StopOutlined />}
            onClick={accion('cancelar')}
            className={styles.actionButton}
            aria-label={`Cancelar la solicitud aceptada de ${solicitud.applicant.fullName}`}
            data-testid={`${testIdPrefix}-cancelar-button`}
          >
            Cancelar solicitud
          </Button>
        )}
      </div>
    )
  }

  return null
}

// ─── Fila ───────────────────────────────────────────────────────────────

/** Props de {@link FilaSolicitudRecibida}. */
interface FilaSolicitudRecibidaProps {
  solicitud: Solicitud
  otraAceptada: Solicitud | undefined
  /** Es la que se ve en el panel del costado (borde y fondo azul, `aria-current`). */
  seleccionada: boolean
  /**
   * Si muestra los botones (Aceptar, Rechazar, Cancelar o "Ver detalle").
   * `true` solo en móvil, donde no hay panel al costado; lo decide el mismo
   * corte de 768 px que el CSS (`SolicitudesRecibidas#MEDIA_MOVIL`).
   */
  conAcciones: boolean
  onAbrir: (solicitud: Solicitud) => void
  onAccion: (accion: AccionSolicitud, solicitud: Solicitud) => void
}

/** Una solicitud recibida dentro del grupo de su propiedad. */
export function FilaSolicitudRecibida({ solicitud, otraAceptada, seleccionada, conAcciones, onAbrir, onAccion }: FilaSolicitudRecibidaProps) {
  const cerrada = solicitud.status === 'rechazada' || solicitud.status === 'cancelada'

  return (
    <div className={`${styles.row} ${seleccionada ? styles.rowSelected : ''}`} onClick={() => onAbrir(solicitud)} data-testid="solicitudes-fila">
      <Avatar size={42} className={seleccionada ? styles.avatarSelected : styles.avatar} aria-hidden="true">
        {iniciales(solicitud.applicant.fullName)}
      </Avatar>
      <div className={styles.rowBody}>
        <div className={styles.rowHead}>
          {/* El nombre es el botón que abre el detalle (teclado y lectores de pantalla). */}
          <button
            type="button"
            className={styles.nameButton}
            onClick={(event) => {
              event.stopPropagation()
              onAbrir(solicitud)
            }}
            aria-label={`Ver la solicitud de ${solicitud.applicant.fullName}`}
            // La que se ve en el panel del costado: los lectores de pantalla la anuncian como "actual".
            aria-current={seleccionada ? 'true' : undefined}
          >
            {solicitud.applicant.fullName}
          </button>
          <StatusTag domain="solicitud" status={solicitud.status} />
          <span className={styles.rowDate} data-testid="solicitudes-fila-tiempo">
            {fechaFilaRecibida(solicitud)}
          </span>
        </div>
        {/* US-36: el resumen, sin datos sensibles. `undefined` no pasa en esta lista (siempre es la vista del locador). */}
        {solicitud.summary !== undefined && (
          <span className={styles.rowSummary} data-testid="solicitudes-fila-resumen">
            {solicitud.summary ? textoResumen(solicitud.summary) : 'Sin datos de legajo'}
          </span>
        )}
        {/* Extracto de 2 líneas (CSS): el mensaje completo está en el detalle. */}
        {solicitud.message ? (
          <span className={styles.rowMessage} data-testid="solicitudes-fila-mensaje">
            {solicitud.message}
          </span>
        ) : (
          <span className={styles.rowLine} data-testid="solicitudes-fila-mensaje">
            Sin mensaje.
          </span>
        )}
        <span className={styles.rowLine}>{lineaRecibida(solicitud, otraAceptada, puedeCancelarAceptada)}</span>
        {solicitud.status === 'rechazada' && solicitud.rejectionMessage && (
          <span className={styles.rejectionNote} data-testid="solicitudes-motivo-rechazo">
            <span className={styles.rejectionLabel}>Tu motivo: </span>
            {truncar(solicitud.rejectionMessage, MENSAJE_RECHAZO_LISTADO_MAX)}
          </span>
        )}
      </div>
      {!conAcciones ? null : cerrada ? (
        <div className={styles.actions}>
          <Button
            type="link"
            className={styles.linkAction}
            onClick={(event) => {
              event.stopPropagation()
              onAbrir(solicitud)
            }}
            data-testid="solicitudes-ver-detalle"
          >
            Ver detalle
          </Button>
        </div>
      ) : (
        <AccionesSolicitudRecibida solicitud={solicitud} otraAceptada={otraAceptada} onAccion={onAccion} variante="fila" testIdPrefix="solicitudes" />
      )}
    </div>
  )
}
