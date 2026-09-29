/**
 * /panel — Mi panel, el inicio de cada rol.
 *
 * Qué es: el locador ve su panel de inicio (plata del mes, reclamos y
 * contratos, o el onboarding si no tiene propiedades) y el locatario, la
 * versión mínima de su panel (buscar o publicar). Todo eso está en
 * `components/panel/PanelInicio.tsx`, que es Client Component porque depende
 * del rol activo; esta página queda del lado del servidor para poder
 * exportar el título de la pestaña.
 * Cubre: sin US en Sprint 0 (inicio del locador, mapa A3); los conteos de
 * propiedades salen de US-02.
 * Entra desde: el login, el ítem "Mi panel" del menú y el cambio de rol.
 */
import type { Metadata } from 'next'
import { PanelInicio } from '@/components/panel/PanelInicio'

/** Título de la pestaña del navegador (el layout raíz le suma "— RentAR"). */
export const metadata: Metadata = { title: 'Mi panel' }

/** Inicio del panel (ver `PanelInicio`). */
export default function PanelInicioPage() {
  return <PanelInicio />
}
