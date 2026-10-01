/**
 * Recientes.tsx — trae las publicaciones más recientes y elige qué mostrar:
 * las tarjetas, el estado vacío o el error.
 *
 * Qué es: un Server Component asincrónico: corre dentro del `Suspense` de
 * `RecientesSection`, que muestra el esqueleto mientras tanto.
 * Cubre: US-34 Consultar propiedades a alquilar (vista previa).
 * De dónde saca los datos: `services/propiedades.service.ts#listarPropiedadesRecientes`.
 * Quién lo usa: `RecientesSection.tsx`.
 *
 * NOTA: si el back no responde, se muestra el error con "Reintentar" (no
 * "no hay propiedades": sería mentir). Con 0 publicadas, el estado vacío.
 * Si hay menos de 6, se muestran las que haya, sin relleno.
 */
import type { PropiedadResumen } from '@rentar/shared-types'
import { listarPropiedadesRecientes } from '@/services/propiedades.service'
import { RecientesGrilla } from './RecientesGrilla'
import { RecientesError, RecientesVacio } from './RecientesEstados'

/** Cuántas publicaciones muestra la landing (decisión del PO, 01/10/2026). */
const CANTIDAD_RECIENTES = 6

/** Tarjetas de las publicaciones más recientes (o su estado vacío o de error). */
export async function Recientes() {
  let propiedades: PropiedadResumen[]
  try {
    propiedades = await listarPropiedadesRecientes(CANTIDAD_RECIENTES)
  } catch {
    return <RecientesError />
  }
  if (propiedades.length === 0) return <RecientesVacio />
  return <RecientesGrilla propiedades={propiedades} />
}
