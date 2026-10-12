'use client'

/**
 * ModalEliminar.tsx — US-04 Eliminar mis propiedades: la confirmación o el
 * aviso de que no se puede.
 *
 * Qué muestra (Claude Design, "Detalle de propiedad del locador" · 05):
 * - **Se puede eliminar** (`danger`): "¿Eliminar <dirección>?", qué pasa (deja
 *   de verse en Mis propiedades y en la búsqueda; borrado lógico, decisión
 *   del PO) y cuántas solicitudes se van a cancelar ("Las N solicitudes de
 *   esta propiedad se van a cancelar"), con el mail a cada postulante.
 * - **Bloqueado por contrato vigente** (sin `danger` y con un solo botón):
 *   explica por qué no se puede. NOTA: el diseño suma "podés pausar" y "Ver
 *   el contrato"; no van (pausar no es de esta tanda y Contratos no existe).
 * Si la acción falla, el error queda dentro del modal y se puede reintentar.
 *
 * De dónde saca los datos: la cantidad de solicitudes que se cancelan, de
 * `contarSolicitudesQueSeCancelan` (con el back real es 0: no tiene el módulo
 * de solicitudes, así que no se avisa nada); eliminar, de `eliminarPropiedad`.
 * Quién lo usa: `MiPropiedad`.
 */
import { useCallback, useState } from 'react'
import { Alert } from 'antd'
import type { PropiedadLocadorDetalle } from '@rentar/shared-types'
import { ConfirmActionModal } from '@rentar/ui'
import { useServiceCall } from '@/lib/hooks/useServiceCall'
import { eliminarPropiedad } from '@/services/propiedades.service'
import { ServiceError } from '@/services/shared/errors'
import { contarSolicitudesQueSeCancelan } from '@/services/solicitudes.service'
import { fecha } from './textosPropiedad'
import styles from './MiPropiedad.module.css'

/** Props de {@link ModalEliminar}. Se monta solo mientras está abierto. */
interface ModalEliminarProps {
  detalle: PropiedadLocadorDetalle
  onCerrar: () => void
  /** Se eliminó: la pantalla vuelve a Mis propiedades con el aviso. */
  onEliminada: () => void
}

/** "La solicitud … se va a cancelar" / "Las 2 solicitudes … se van a cancelar". */
function textoSolicitudes(cantidad: number): string {
  return cantidad === 1
    ? 'La solicitud de esta propiedad se va a cancelar. Le avisamos por mail a quien la envió.'
    : `Las ${cantidad} solicitudes de esta propiedad se van a cancelar. Le avisamos por mail a cada postulante.`
}

/** Aviso de bloqueo por contrato vigente (· 05), con un solo botón. */
function AvisoBloqueado({ detalle, onCerrar }: Pick<ModalEliminarProps, 'detalle' | 'onCerrar'>) {
  const contrato = detalle.activeContract
  // El locatario y la fecha de fin van solo si el back los informa (con el back real, la fecha no llega todavía).
  const aQuien = contrato?.tenantName ? ` a ${contrato.tenantName}` : ''
  const hasta = contrato?.endDate ? ` hasta el ${fecha(contrato.endDate)}` : ''
  const descripcion = contrato
    ? `${detalle.address} está alquilada${aQuien}${hasta}. Para eliminarla, primero tiene que terminar el contrato.`
    : 'Para eliminarla, primero tiene que terminar el contrato.'
  return (
    <ConfirmActionModal
      open
      title="No podés eliminar una propiedad con contrato vigente"
      description={descripcion}
      confirmLabel="Entendido"
      hideCancel
      onConfirm={onCerrar}
      onCancel={onCerrar}
      data-testid="mi-propiedad-eliminar-bloqueado-modal"
    />
  )
}

/** Confirmación de eliminar, con las solicitudes que se van a cancelar. */
function ConfirmarEliminar({ detalle, onCerrar, onEliminada }: ModalEliminarProps) {
  // ─── Estado local ───────────────────────────────────────────────────
  const [enCurso, setEnCurso] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const contarActivas = useCallback(() => contarSolicitudesQueSeCancelan(detalle.id), [detalle.id])
  const activas = useServiceCall(contarActivas)

  // ─── Handlers ───────────────────────────────────────────────────────
  async function confirmar(): Promise<void> {
    setEnCurso(true)
    setError(null)
    try {
      await eliminarPropiedad(detalle.id)
      onEliminada()
    } catch (causa: unknown) {
      setError(causa instanceof ServiceError ? causa.message : 'No pudimos eliminar la propiedad. Probá de nuevo en un momento.')
      setEnCurso(false)
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────
  return (
    <ConfirmActionModal
      open
      danger
      title={`¿Eliminar ${detalle.address}?`}
      description="Deja de verse en Mis propiedades y en la búsqueda. Los contratos y reclamos anteriores se conservan. Esto no se puede deshacer."
      confirmLabel="Eliminar propiedad"
      confirmLoading={enCurso}
      onConfirm={() => void confirmar()}
      onCancel={() => !enCurso && onCerrar()}
      data-testid="mi-propiedad-eliminar-modal"
    >
      {/* Decisión del PO: el modal avisa cuántas solicitudes se cancelan, solo si hay alguna.
          Si el conteo falla, no se dice nada: mejor que prometer un mail que quizá no se manda. */}
      {activas.status === 'listo' && activas.data > 0 && (
        <p className={styles.modalNote} data-testid="mi-propiedad-eliminar-solicitudes">
          {textoSolicitudes(activas.data)}
        </p>
      )}
      {error && <Alert type="error" showIcon className={styles.modalAlert} title="No pudimos eliminar la propiedad" description={error} data-testid="mi-propiedad-eliminar-error" />}
    </ConfirmActionModal>
  )
}

/** Eliminar o el aviso de bloqueo, según tenga contrato vigente. */
export function ModalEliminar(props: ModalEliminarProps) {
  return props.detalle.activeContract ? <AvisoBloqueado detalle={props.detalle} onCerrar={props.onCerrar} /> : <ConfirmarEliminar {...props} />
}
