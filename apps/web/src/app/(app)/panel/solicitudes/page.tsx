/**
 * /panel/solicitudes — Solicitudes recibidas (US-36 Consultar, US-37 Aceptar
 * o rechazar y US-38 Cancelar solicitud de alquiler, numeración de Jira).
 *
 * Qué es: las solicitudes que recibió el locador sobre sus propiedades,
 * agrupadas por propiedad. La pantalla vive en
 * `components/solicitudes/SolicitudesRecibidas.tsx`; acá solo se monta.
 * Solo para el rol locador (`RequireRole`): un locatario vuelve a `/panel`.
 * Entra desde: el ítem "Solicitudes" del menú del locador y el link "N
 * solicitudes nuevas" del panel.
 */
import type { Metadata } from 'next'
import { RequireRole } from '@/components/auth/RequireRole'
import { SolicitudesRecibidas } from '@/components/solicitudes/SolicitudesRecibidas'

/** Título de la pestaña del navegador (el layout raíz le suma "— RentAR"). */
export const metadata: Metadata = { title: 'Solicitudes' }

/** Monta Solicitudes recibidas, solo para locadores. */
export default function SolicitudesPage() {
  return (
    <RequireRole role="locador">
      <SolicitudesRecibidas />
    </RequireRole>
  )
}
