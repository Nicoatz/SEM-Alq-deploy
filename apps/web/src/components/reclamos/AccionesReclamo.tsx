'use client'

/**
 * AccionesReclamo.tsx — "Cancelar reclamo" y "Marcar como resuelto", del locatario.
 *
 * Cubre:
 * - US-16 Resolver: "Solo se puede marcar como resuelto un reclamo … 'en
 *   proceso'". Con el reclamo abierto, el botón aparece deshabilitado con el
 *   motivo "Esperá la respuesta del locador". Pide confirmación.
 * - US-17 Cancelar: desde "abierto" o "en proceso". Pide confirmación (variante danger).
 * - Las dos: solo el locatario que registró el reclamo (el locador no tiene
 *   botones de estado, decisión del PO del 24/11). Con el reclamo resuelto o
 *   cancelado, los botones desaparecen.
 * - Si el estado cambió en otra pestaña (409), el modal se cierra, la pantalla
 *   muestra "Este reclamo ya está resuelto: no se puede cancelar." y se refresca.
 *
 * Qué muestra (Claude Design, "Reclamos" · US-16 02 y US-17 02): los textos de los
 * dos modales del diseño.
 *
 * Quién lo usa: `DetalleReclamo`.
 */
import { useState } from 'react'
import { Alert, Button, Tooltip } from 'antd'
import { ConfirmActionModal } from '@rentar/ui'
import { puedeCancelar, puedeResolver } from '@/lib/reclamos/reglas'
import type { Reclamo } from '@/lib/reclamos/tipos'
import { fragmentoMensaje } from '@/lib/reclamos/filtros'
import { truncar } from '@/lib/utils/truncar'
import { cancelarReclamo, resolverReclamo } from '@/services/reclamos.service'
import { ServiceError } from '@/services/shared/errors'
import styles from './DetalleReclamo.module.css'

/** Props de {@link AccionesReclamo}. */
interface AccionesReclamoProps {
  reclamo: Reclamo
  usuarioId: string
  /** El reclamo quedó con otro estado (por la acción o porque cambió en otra pestaña). */
  onCambio: (resultado: { reclamo?: Reclamo; aviso?: string }) => void
}

type Accion = 'resolver' | 'cancelar'

/** Botones de estado del locatario que registró el reclamo. */
export function AccionesReclamo({ reclamo, usuarioId, onCambio }: AccionesReclamoProps) {
  const [abierta, setAbierta] = useState<Accion | null>(null)
  const [enCurso, setEnCurso] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resolver = puedeResolver(reclamo, usuarioId)
  const cancelar = puedeCancelar(reclamo, usuarioId)
  // Resuelto o cancelado (o no es el autor): sin botones.
  if (!cancelar.permitido && !resolver.permitido) return null

  // ─── Handlers ───────────────────────────────────────────────────────
  async function confirmar(): Promise<void> {
    if (!abierta) return
    setEnCurso(true)
    setError(null)
    try {
      const actualizado = abierta === 'resolver' ? await resolverReclamo(reclamo.id) : await cancelarReclamo(reclamo.id)
      setAbierta(null)
      onCambio({ reclamo: actualizado })
    } catch (causa) {
      const servicio = causa instanceof ServiceError ? causa : null
      if (servicio?.code === 'conflict') {
        // El estado cambió en otra pestaña: se cierra el modal y la pantalla se refresca con el aviso.
        setAbierta(null)
        onCambio({ aviso: servicio.message })
      } else {
        setError(servicio?.message ?? 'No pudimos cambiar el estado del reclamo. Probá de nuevo.')
      }
    } finally {
      setEnCurso(false)
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────
  const locador = reclamo.locador.nombre.split(' ')[0] ?? 'el locador'
  const botonResolver = (
    <Button type="primary" onClick={() => setAbierta('resolver')} disabled={!resolver.permitido} data-testid="reclamo-resolver-button">
      Marcar como resuelto
    </Button>
  )

  return (
    <div className={styles.acciones}>
      {cancelar.permitido && (
        <Button danger onClick={() => setAbierta('cancelar')} data-testid="reclamo-cancelar-button">
          Cancelar reclamo
        </Button>
      )}
      {resolver.permitido ? (
        botonResolver
      ) : (
        // El botón deshabilitado no recibe el mouse: el motivo va en el envoltorio (prompt de la Tanda B).
        <Tooltip title={resolver.motivo}>
          <span className={styles.bloqueado} data-testid="reclamo-resolver-bloqueado" aria-label={resolver.motivo}>
            {botonResolver}
          </span>
        </Tooltip>
      )}
      {!resolver.permitido && (
        <span className={styles.motivo} data-testid="reclamo-resolver-motivo">
          {resolver.motivo}
        </span>
      )}

      <ConfirmActionModal
        open={abierta === 'resolver'}
        title="¿Marcar el reclamo como resuelto?"
        description={`Confirmás que ${locador} solucionó el reclamo ${reclamo.codigo} de ${reclamo.propiedad.direccion}. Pasa a resuelto y ya no se puede cancelar.`}
        confirmLabel="Sí, está resuelto"
        cancelLabel="Volver"
        confirmLoading={enCurso}
        onConfirm={() => void confirmar()}
        onCancel={() => {
          setAbierta(null)
          setError(null)
        }}
        data-testid="reclamo-resolver-modal"
      >
        {error && <Alert type="error" title={error} data-testid="reclamo-accion-error" />}
      </ConfirmActionModal>

      <ConfirmActionModal
        open={abierta === 'cancelar'}
        title={`¿Cancelar el reclamo ${reclamo.codigo}?`}
        description={`"${truncar(fragmentoMensaje(reclamo.mensaje), 40)}" pasa a cancelado y le avisamos a ${locador}. Sigue en tu listado, pero ya no se puede resolver.`}
        confirmLabel="Cancelar reclamo"
        cancelLabel="Volver"
        danger
        confirmLoading={enCurso}
        onConfirm={() => void confirmar()}
        onCancel={() => {
          setAbierta(null)
          setError(null)
        }}
        data-testid="reclamo-cancelar-modal"
      >
        {error && <Alert type="error" title={error} data-testid="reclamo-accion-error" />}
      </ConfirmActionModal>
    </div>
  )
}
