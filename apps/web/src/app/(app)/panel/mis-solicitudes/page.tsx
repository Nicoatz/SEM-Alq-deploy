/**
 * /panel/mis-solicitudes — Mis solicitudes (US-36 Consultar solicitudes de
 * alquiler, numeración de Jira; cancelar una pendiente: sin US en Sprint 0,
 * mapa US-39).
 *
 * Qué es: las solicitudes que envió el usuario en sesión. La pantalla vive
 * en `components/mis-solicitudes/MisSolicitudes.tsx`; acá solo se monta.
 * Para cualquier usuario con sesión (la pide `proxy.ts`), sin `RequireRole`:
 * cualquiera puede solicitar una propiedad.
 * Entra desde: el ítem "Mis solicitudes" del menú del locatario, "Ver mis
 * solicitudes" (éxito del modal, US-35) y "Ver en Mis solicitudes" (detalle
 * de la propiedad, US-41).
 */
import type { Metadata } from 'next'
import { MisSolicitudes } from '@/components/mis-solicitudes/MisSolicitudes'

/** Título de la pestaña del navegador (el layout raíz le suma "— RentAR"). */
export const metadata: Metadata = { title: 'Mis solicitudes' }

/** Monta Mis solicitudes. */
export default function MisSolicitudesPage() {
  return <MisSolicitudes />
}
