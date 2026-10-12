'use client'

/**
 * FilaSolicitudRecibida.tsx — una solicitud en la lista del locador, y los
 * botones de acción que comparte con el detalle del postulante.
 *
 * Qué muestra (Claude Design, "Flujo de solicitudes" · 02): avatar con
 * iniciales, nombre y apellido del postulante (US-36), `StatusTag` del
 * dominio `solicitud`, cuándo llegó o cuándo se respondió, la línea que
 * explica el estado, y las acciones según el estado
 * (`TRANSICIONES_SOLICITUD`):
 * - Pendiente: Aceptar y Rechazar (US-37: "distinguir claramente el botón
 *   de aceptar y el de rechazar": azul lleno con ✓ y blanco con ✕). Si la
 *   propiedad ya tiene una aceptada, Aceptar queda deshabilitado con el
 *   motivo en un tooltip (una sola aceptada por propiedad).
 * - Aceptada: Cancelar solicitud (US-38).
 * - Rechazada o cancelada: Ver detalle.
 * NOTA: "Iniciar contrato" y "Mensaje" de la aceptada no van: contratos y
 * mensajes son de otro sprint.
 *
 * Quién lo usa: `GrupoPropiedad` (la fila) y `DetallePostulante` (las acciones).
 */
import type { MouseEvent } from 'react'
import { Avatar, Button, Tooltip } from 'antd'
import { CheckOutlined, CloseOutlined, StopOutlined } from '@ant-design/icons'
import type { Solicitud } from '@rentar/shared-types'
import { StatusTag } from '@rentar/ui'
import { fechaFilaRecibida, lineaRecibida } from '@/lib/solicitudes/textos'
import { iniciales } from '@/lib/utils/iniciales'
import { puedeHacerAccion, textoYaAceptaste, type AccionSolicitud } from '@/lib/validation/solicitud.rules'
import styles from './SolicitudesRecibidas.module.css'

// ─── Acciones ───────────────────────────────────────────────────────────

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
          <Tooltip title={textoYaAceptaste(otraAceptada.applicant.fullName)}>
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

  if (puedeHacerAccion('cancelar', 'locador', solicitud.status)) {
    return (
      <div className={clase}>
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
  /** Es la que se ve en el panel del costado (borde azul). */
  seleccionada: boolean
  onAbrir: (solicitud: Solicitud) => void
  onAccion: (accion: AccionSolicitud, solicitud: Solicitud) => void
}

/** Una solicitud recibida dentro del grupo de su propiedad. */
export function FilaSolicitudRecibida({ solicitud, otraAceptada, seleccionada, onAbrir, onAccion }: FilaSolicitudRecibidaProps) {
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
          >
            {solicitud.applicant.fullName}
          </button>
          <StatusTag domain="solicitud" status={solicitud.status} />
          <span className={styles.rowDate}>{fechaFilaRecibida(solicitud)}</span>
        </div>
        <span className={styles.rowLine}>{lineaRecibida(solicitud, otraAceptada)}</span>
      </div>
      {cerrada ? (
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
