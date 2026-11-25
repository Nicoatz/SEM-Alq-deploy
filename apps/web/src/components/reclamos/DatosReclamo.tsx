/**
 * DatosReclamo.tsx — "Datos del reclamo", la ficha al costado del detalle.
 *
 * Qué muestra (Claude Design, "Reclamos" · 03): número, propiedad, la otra parte,
 * tipo, estado, fecha de registro y cuántas fotos tiene. Con `DetailList`.
 * NOTA: "En proceso desde el 14/09/2026 · 10:41" (y las fechas de resuelto o
 * cancelado) solo se ven si el dato existe: en real el back no guarda la fecha de
 * cada cambio de estado (brecha R-9, decisión del PO del 25/11) y queda solo el estado.
 * Cubre US-15 ("al consultar el detalle … todos los datos visibles al consultar todos los reclamos").
 *
 * Quién lo usa: `DetalleReclamo`.
 */
import { DetailList, formatDate } from '@rentar/ui'
import { labelTipoReclamo } from '@/lib/reclamos/catalogo'
import { ESTADO_RECLAMO_TEXTO } from '@/lib/reclamos/catalogo'
import type { Reclamo } from '@/lib/reclamos/tipos'
import styles from './DetalleReclamo.module.css'

/** Props de {@link DatosReclamo}. */
interface DatosReclamoProps {
  reclamo: Reclamo
  /** Desde qué lado se mira: muestra a la otra parte. */
  vista: 'locador' | 'locatario'
}

/** "13/09/2026 · 09:12". */
function fechaHora(fechaIso: string): string {
  return `${formatDate(fechaIso)} · ${formatDate(fechaIso, 'HH:mm')}`
}

/** "En proceso desde el 14/09/2026 · 10:41", o solo el estado si no hay fecha. */
function textoEstado(reclamo: Reclamo): string {
  const estado = ESTADO_RECLAMO_TEXTO[reclamo.estado].singular
  const conMayuscula = estado.charAt(0).toUpperCase() + estado.slice(1)
  const desde = reclamo.estado === 'en_proceso' ? reclamo.enProcesoDesde : reclamo.estado === 'abierto' ? null : reclamo.cerradoEl
  if (!desde) return conMayuscula
  return reclamo.estado === 'en_proceso' ? `${conMayuscula} desde el ${fechaHora(desde)}` : `${conMayuscula} el ${fechaHora(desde)}`
}

/** Ficha con los datos del reclamo. */
export function DatosReclamo({ reclamo, vista }: DatosReclamoProps) {
  const otra = vista === 'locatario' ? { label: 'Locador', nombre: reclamo.locador.nombre } : { label: 'Locatario', nombre: reclamo.locatario.nombre }
  const fotos = reclamo.fotos.length
  return (
    <section className={styles.tarjeta} data-testid="reclamo-datos">
      <DetailList
        title="Datos del reclamo"
        column={1}
        items={[
          { label: 'Número', value: reclamo.codigo },
          { label: 'Propiedad', value: reclamo.propiedad.direccion },
          { label: otra.label, value: otra.nombre },
          { label: 'Tipo', value: labelTipoReclamo(reclamo.tipo) },
          { label: 'Estado', value: <span data-testid="reclamo-datos-estado">{textoEstado(reclamo)}</span> },
          { label: 'Registrado el', value: fechaHora(reclamo.creadoEl) },
          { label: 'Fotos', value: fotos === 0 ? 'Sin fotos' : `${fotos} ${fotos === 1 ? 'adjunta' : 'adjuntas'}` },
        ]}
      />
    </section>
  )
}
