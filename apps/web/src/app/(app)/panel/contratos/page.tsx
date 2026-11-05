/**
 * /panel/contratos — ya no es una pantalla: redirige a Mis propiedades.
 *
 * Qué es: US-43: "No existe un listado con los contratos de todas las
 * propiedades del locador". Los contratos se ven en la pestaña Contratos de
 * cada propiedad. Se deja el redirect para los enlaces guardados; siguen
 * `[id]`, `[id]/editar` y `nuevo?solicitud=`.
 */
import { redirect } from 'next/navigation'
import { MIS_PROPIEDADES_HREF } from '@/lib/contratos/rutas'

/** Manda a Mis propiedades. */
export default function ContratosPage() {
  redirect(MIS_PROPIEDADES_HREF)
}
