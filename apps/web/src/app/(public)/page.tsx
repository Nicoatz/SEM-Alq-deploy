/**
 * / — landing pública (arquetipo A1). Sin vista de Claude Design: la landing
 * ya existía implementada y se migró tal cual.
 *
 * De dónde saca los datos: `services/propiedades.service.ts#listarPropiedadesPublicadas`
 * (US-34), llamado acá, del lado del servidor.
 *
 * NOTA: del lado del servidor no hay `localStorage`, así que la landing
 * muestra solo el elenco (no las propiedades creadas en el alta en modo
 * mock). `/buscar` sí las muestra, porque carga del lado del cliente.
 */
import type { PropiedadResumen } from '@rentar/shared-types'
import Landing from '@/components/Landing'
import { listarPropiedadesPublicadas } from '@/services/propiedades.service'

export default async function LandingPage() {
  let properties: PropiedadResumen[] = []
  let loadError = false
  try {
    properties = await listarPropiedadesPublicadas()
  } catch {
    // NOTA: si el backend real no responde, la landing se muestra igual (Hero
    // y "Cómo funciona"), y en lugar del grid va un error con "Reintentar".
    // No se muestra "No encontramos propiedades con esos filtros": sería
    // mentirle al usuario sobre los filtros.
    loadError = true
  }
  return <Landing properties={properties} loadError={loadError} />
}
