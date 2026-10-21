/**
 * /panel/perfil — Mi perfil y legajo (US-20 Consultar usuario y US-21
 * Modificar usuario).
 *
 * Qué es: la pantalla vive en `components/perfil/PerfilScreen.tsx`; acá
 * solo se monta. Para cualquier usuario con sesión (la pide `proxy.ts`), sin
 * `RequireRole`: es la misma pantalla para locadores y locatarios. Solo
 * muestra el perfil propio (no hay id en la ruta).
 * Entra desde: "Mi perfil y legajo" del UserMenu.
 */
import type { Metadata } from 'next'
import { PerfilScreen } from '@/components/perfil/PerfilScreen'

/** Título de la pestaña del navegador (el layout raíz le suma "— RentAR"). */
export const metadata: Metadata = { title: 'Mi perfil' }

/** Monta Mi perfil. */
export default function PerfilPage() {
  return <PerfilScreen />
}
