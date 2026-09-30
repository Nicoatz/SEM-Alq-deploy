/**
 * /login — Iniciar sesión (US-39 Iniciar y cerrar sesión). Arquetipo A2 (AuthLayout).
 *
 * Diseño: Claude Design, "Autenticación" · 01, 02 y 05.
 * Entra desde: "Iniciar sesión" del Header, `proxy.ts` (al pedir `/panel/*`
 * sin sesión, con `?next=`) y "Salir" del UserMenu (vuelve a la landing).
 *
 * `next` llega por la URL y se valida con `safeNextPath` (solo rutas
 * internas) antes de pasárselo al formulario. `email` (opcional) precarga
 * el campo: lo usa la pantalla de cuenta creada del registro.
 */
import type { Metadata } from 'next'
// Import directo (no del barrel @rentar/ui): ese barrel también re-exporta
// statusMeta, que rompe el build en cualquier Server Component que lo
// importe (ver el comentario en app/layout.tsx).
import { AuthLayout } from '@rentar/ui/src/components/layouts/AuthLayout'
import { LoginForm } from '@/components/auth/LoginForm'
import { safeNextPath } from '@/lib/auth/redirect'
import { haySesionProbable } from '@/lib/auth/sesion-probable'

/** Título de la pestaña del navegador (el layout raíz le suma "— RentAR"). */
export const metadata: Metadata = { title: 'Iniciar sesión' }

interface LoginPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next, email } = await searchParams
  // Pista para no mostrar el formulario un instante si ya hay sesión (ver `sesion-probable.ts`).
  const sesionProbable = await haySesionProbable()
  return (
    <AuthLayout title="Iniciar sesión" subtitle="Entrá a tu cuenta de RentAR" data-testid="login-page">
      <LoginForm next={safeNextPath(next)} initialEmail={typeof email === 'string' ? email : undefined} sesionProbable={sesionProbable} />
    </AuthLayout>
  )
}
