/**
 * /registro — Registrar usuario (US-19). Arquetipo A2 (AuthLayout).
 *
 * Diseño: Claude Design, "Autenticación" · 03 (tus datos) y 05 (estados).
 * Entra desde: "Creá una gratis" / "Registrate" del login.
 *
 * Lee de la URL:
 * - `next`: adónde se quería ir antes (validado con `safeNextPath`). Se usa
 *   para el link "Iniciar sesión" (quien ya tiene cuenta vuelve a ese destino).
 *
 * Con sesión, lleva a `/panel` (lo resuelve `RegistroForm`).
 *
 * NOTA: el registro ya no pregunta el rol (regla del equipo, 27/09/2026):
 * toda cuenta nueva es locataria y pasa a ser también locadora al publicar su
 * primera propiedad. `?rol=` ya no se lee.
 */
import { RegistroForm } from '@/components/auth/RegistroForm'
import { safeNextPath } from '@/lib/auth/redirect'
import { haySesionProbable } from '@/lib/auth/sesion-probable'

interface RegistroPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function RegistroPage({ searchParams }: RegistroPageProps) {
  const params = await searchParams
  // Pista para no mostrar el formulario un instante si ya hay sesión (ver `sesion-probable.ts`).
  return <RegistroForm next={safeNextPath(params.next)} sesionProbable={await haySesionProbable()} />
}
