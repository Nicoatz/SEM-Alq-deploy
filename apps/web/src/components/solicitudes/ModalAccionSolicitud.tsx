'use client'

/**
 * ModalAccionSolicitud.tsx — la confirmación de aceptar, rechazar o cancelar
 * una solicitud, con `ConfirmActionModal` de `@rentar/ui`.
 *
 * Qué muestra (Claude Design, "Flujo de solicitudes" · 03, 04 y 06):
 * - Aceptar (US-37): "¿Aceptar la solicitud de X?" y, en el momento de
 *   decidir, que las otras pendientes de la propiedad siguen pendientes.
 * - Rechazar (US-37): sin motivo. NOTA: el diseño suma un motivo opcional y
 *   "no puede volver a solicitar por 30 días"; ninguno de los dos va
 *   (decisión del PO: US-37 no lo pide y no hay bloqueo de 30 días).
 * - Cancelar del locador, una aceptada (US-38): le avisa por mail al
 *   locatario (lo manda el back) y vuelve a poder aceptar a otro.
 * - Cancelar del postulante, una pendiente: sin US en Sprint 0 (mapa US-39).
 * - El error de la acción, adentro del modal y con "Reintentar" (· 06).
 * Ninguna de las cuatro borra nada: ningún botón va en rojo (· 03).
 *
 * Quién lo usa: `SolicitudesRecibidas` y `MisSolicitudes`.
 */
import { Alert, Button } from 'antd'
import { ConfirmActionModal } from '@rentar/ui'
import type { ActorSolicitud } from '@/lib/validation/solicitud.rules'
import type { EstadoAccionSolicitud } from './useAccionSolicitud'
import styles from './ModalAccionSolicitud.module.css'

/** Props de {@link ModalAccionSolicitud}. */
interface ModalAccionSolicitudProps {
  /** Lo que devuelve `useAccionSolicitud`. */
  estado: EstadoAccionSolicitud
  /** Quién confirma: cambia los textos de "Cancelar". */
  actor: ActorSolicitud
  /** Para "Aceptar": cuántas otras solicitudes pendientes tiene la propiedad. */
  otrasPendientes?: number
  /** Prefijo de los `data-testid` (`solicitudes` o `mis-solicitudes`). */
  testIdPrefix: string
}

/** Textos del modal para cada acción y actor. */
interface TextosModal {
  title: string
  description: string
  confirmLabel: string
  cancelLabel: string
  /** "aceptar la solicitud", para el título del error. */
  verbo: string
}

/** "La otra solicitud … sigue pendiente" / "Las otras 2 solicitudes … siguen pendientes". */
function textoOtrasPendientes(cantidad: number, direccion: string): string {
  const de = direccion ? ` de ${direccion}` : ''
  return cantidad === 1 ? `La otra solicitud${de} sigue pendiente.` : `Las otras ${cantidad} solicitudes${de} siguen pendientes.`
}

/**
 * Elige los textos. Se habla de vos y se dice qué pasa después (· 07).
 * "Le avisamos por mail": los mails los manda el back (US-37 al aceptar y
 * US-38 al cancelar); el front solo lo cuenta.
 */
function textosDe(estado: EstadoAccionSolicitud, actor: ActorSolicitud): TextosModal | null {
  const pedida = estado.pedida
  if (!pedida) return null
  const nombre = pedida.solicitud.applicant.fullName
  const direccion = pedida.solicitud.property.address
  switch (pedida.accion) {
    case 'aceptar':
      return {
        title: `¿Aceptar la solicitud de ${nombre}?`,
        description: 'Le avisamos por mail que aceptaste su solicitud. Mientras siga aceptada, no vas a poder aceptar otra de esta propiedad.',
        confirmLabel: 'Aceptar solicitud',
        cancelLabel: 'Volver',
        verbo: 'aceptar',
      }
    case 'rechazar':
      return {
        title: `¿Rechazar la solicitud de ${nombre}?`,
        description: 'La solicitud pasa a rechazada. Puede volver a solicitar la propiedad mientras siga publicada.',
        confirmLabel: 'Rechazar',
        cancelLabel: 'Volver',
        verbo: 'rechazar',
      }
    case 'cancelar':
      return actor === 'locador'
        ? {
            title: `¿Cancelar la solicitud aceptada de ${nombre}?`,
            description: `Le avisamos por mail que la cancelaste. Después vas a poder aceptar a otro postulante${direccion ? ` de ${direccion}` : ''}.`,
            confirmLabel: 'Cancelar solicitud',
            cancelLabel: 'Dejarla aceptada',
            verbo: 'cancelar',
          }
        : {
            title: `¿Cancelar tu solicitud${direccion ? ` de ${direccion}` : ''}?`,
            description: 'El dueño deja de verla entre sus pendientes. Si te arrepentís, podés volver a solicitar la propiedad mientras siga publicada.',
            confirmLabel: 'Cancelar solicitud',
            cancelLabel: 'Dejarla activa',
            verbo: 'cancelar',
          }
  }
}

/** El detalle del error: si no se sabe qué pasó, que nada cambió y que pruebe de nuevo (· 06). */
function detalleError(code: string, message: string, estadoActual: string): string {
  const generico = code === 'network' || code === 'server' || code === 'unknown'
  return generico ? `Nada cambió: la solicitud sigue ${estadoActual}. Probá de nuevo en un momento.` : message
}

/** Confirmación de una acción sobre una solicitud. */
export function ModalAccionSolicitud({ estado, actor, otrasPendientes = 0, testIdPrefix }: ModalAccionSolicitudProps) {
  const textos = textosDe(estado, actor)
  const pedida = estado.pedida

  // ─── Render ─────────────────────────────────────────────────────────
  return (
    <ConfirmActionModal
      open={pedida !== null}
      title={textos?.title ?? ''}
      description={textos?.description}
      confirmLabel={textos?.confirmLabel}
      cancelLabel={textos?.cancelLabel}
      confirmLoading={estado.enCurso}
      onConfirm={() => void estado.confirmar()}
      onCancel={estado.cerrar}
      data-testid={pedida ? `${testIdPrefix}-${pedida.accion}-modal` : undefined}
    >
      {/* El aviso de que las otras siguen vivas va acá, en el momento de decidir (· 03). */}
      {pedida?.accion === 'aceptar' && otrasPendientes > 0 && (
        <p className={styles.modalNote}>{textoOtrasPendientes(otrasPendientes, pedida.solicitud.property.address)}</p>
      )}
      {estado.error && textos && pedida && (
        <Alert
          type="error"
          showIcon
          className={styles.modalAlert}
          title={`No pudimos ${textos.verbo} la solicitud`}
          description={detalleError(estado.error.code, estado.error.message, pedida.solicitud.status)}
          action={
            <Button size="small" onClick={() => void estado.confirmar()} loading={estado.enCurso} data-testid={`${testIdPrefix}-accion-reintentar`}>
              Reintentar
            </Button>
          }
          data-testid={`${testIdPrefix}-accion-error`}
        />
      )}
    </ConfirmActionModal>
  )
}
