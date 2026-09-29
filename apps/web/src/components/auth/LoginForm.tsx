'use client'

/**
 * LoginForm.tsx — formulario de `/login` (US-39 Iniciar y cerrar sesión).
 *
 * Qué es: email, contraseña (oculta, con botón para verla),
 * "¿Olvidaste tu contraseña?" y el link al registro. Diseño: Claude Design,
 * "Autenticación" · 01 (escritorio), 02 (móvil y errores) y 05 (estados).
 *
 * De dónde saca los datos: `useAuth().login`, que llama a
 * `services/auth.service.ts#login`.
 *
 * Criterios de US-39 que cubre:
 * - Mail y contraseña obligatorios (reglas de `lib/validation/usuario.rules.ts`).
 * - Contraseña oculta al escribir (`Input.Password`).
 * - Error de credenciales genérico: nunca dice si el mail existe.
 * - Vuelve a la página anterior (`next`, ya validado como ruta interna).
 *
 * NOTA: no hay "Recordarme". Con Supabase Auth la sesión dura hasta que la
 * persona la cierra (el token se renueva solo), así que la opción no tenía
 * efecto. Se sacó del template de Claude Design también (ver
 * `.design-sync/NOTES.md`).
 *
 * Quién lo usa: `app/(auth)/login/page.tsx`.
 */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button, Form, Input } from 'antd'
import { useAuth } from '@/lib/auth/AuthProvider'
import { reglasEmail, reglasPasswordLogin } from '@/lib/validation/usuario.rules'
import { ServiceError } from '@/services/shared/errors'
import { FormAlert } from './FormAlert'
import { serverErrorCopy, type ServerErrorCopy } from './serverError'
import { RevisandoSesion } from './RevisandoSesion'
import { StatusBlock } from './StatusBlock'
import styles from './AuthForm.module.css'

interface LoginFormValues {
  email: string
  password: string
}

interface LoginFormProps {
  /** Ruta interna a la que volver después del login (ya pasada por `safeNextPath`), o `null`. */
  next: string | null
  /** Email precargado (viene del registro, para que solo falte la contraseña). */
  initialEmail?: string
  /** `true` si llegó una cookie de sesión (ver `lib/auth/sesion-probable.ts`). */
  sesionProbable?: boolean
}

/**
 * Adónde ir después del login si no hay `next`: a `/panel`, para los dos
 * roles. El locador ve su panel de inicio; el locatario, la versión mínima
 * (buscar o publicar, "Panel de inicio" · 05b). Antes el locatario iba a
 * `/buscar` porque su panel todavía no existía.
 */
const DEFAULT_DESTINATION = '/panel'

/** Formulario de inicio de sesión. */
export function LoginForm({ next, initialEmail, sesionProbable = false }: LoginFormProps) {
  const router = useRouter()
  const { login, user, isLoading } = useAuth()
  const [form] = Form.useForm<LoginFormValues>()

  // ─── Estado local ───────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false)
  const [credentialsError, setCredentialsError] = useState(false)
  const [serverError, setServerError] = useState<ServerErrorCopy | null>(null)

  // Si ya hay sesión (por ejemplo, volvió con el botón "atrás"), no tiene
  // sentido mostrar el login: se sigue de largo.
  useEffect(() => {
    if (!isLoading && user) {
      router.replace(next ?? DEFAULT_DESTINATION)
    }
  }, [isLoading, user, next, router])

  // ─── Handlers ───────────────────────────────────────────────────────

  async function handleSubmit(values: LoginFormValues): Promise<void> {
    setSubmitting(true)
    setCredentialsError(false)
    setServerError(null)
    try {
      await login({ email: values.email, password: values.password })
      router.replace(next ?? DEFAULT_DESTINATION)
    } catch (error) {
      if (error instanceof ServiceError && error.code === 'unauthorized') {
        // US-39: mensaje genérico arriba y el campo de contraseña marcado,
        // sin decir cuál de los dos datos falló.
        setCredentialsError(true)
        form.setFields([{ name: 'password', value: '', errors: ['Escribila de nuevo'] }])
      } else {
        setServerError(serverErrorCopy(error))
      }
    } finally {
      setSubmitting(false)
    }
  }

  /** "Reintentar" del error del servidor: vuelve a enviar lo que ya estaba escrito. */
  function handleRetry(): void {
    setServerError(null)
    void handleSubmit(form.getFieldsValue(true))
  }

  const registerHref = next ? `/registro?next=${encodeURIComponent(next)}` : '/registro'

  // ─── Render ─────────────────────────────────────────────────────────

  // Con sesión, esta pantalla lleva a `next` o a /panel (efecto de arriba). Para
  // que el formulario no aparezca un instante: mientras se confirma una sesión
  // probable (llegó la cookie) y mientras se redirige, "Revisando tu sesión…".
  // Durante el propio envío no: el botón ya muestra que está entrando.
  if ((sesionProbable && isLoading) || (!isLoading && user && !submitting)) {
    return <RevisandoSesion />
  }

  if (serverError) {
    return (
      <StatusBlock
        variant="error"
        title={serverError.title}
        description={serverError.description}
        actions={
          <Button type="primary" onClick={handleRetry} data-testid="auth-retry-button">
            Reintentar
          </Button>
        }
        data-testid="auth-server-error"
      />
    )
  }

  return (
    <Form<LoginFormValues>
      form={form}
      layout="vertical"
      requiredMark={false}
      validateTrigger="onBlur"
      scrollToFirstError={{ focus: true, block: 'center' }}
      disabled={submitting}
      onFinish={handleSubmit}
      initialValues={{ email: initialEmail }}
      className={styles.form}
      data-testid="login-form"
    >
      {credentialsError && (
        <FormAlert
          title="El email o la contraseña no coinciden"
          description={
            <>
              Revisá los datos o <Link href="/recuperar">recuperá tu contraseña</Link>.
            </>
          }
          data-testid="login-error-alert"
        />
      )}

      <Form.Item label="Email" name="email" rules={reglasEmail}>
        <Input type="email" autoComplete="email" inputMode="email" data-testid="login-email-input" />
      </Form.Item>

      {/* US-39: "reemplazar visualmente los caracteres de la contraseña" → Input.Password. */}
      <Form.Item label="Contraseña" name="password" rules={reglasPasswordLogin}>
        <Input.Password autoComplete="current-password" data-testid="login-password-input" />
      </Form.Item>

      <div className={`${styles.forgotRow} ${styles.desktopOnly}`}>
        <Link href="/recuperar" className={styles.link} data-testid="login-forgot-link">
          ¿Olvidaste tu contraseña?
        </Link>
      </div>

      {/* El Form entero se deshabilita al enviar, pero el botón no (disabled={false}):
          tiene que verse azul con el spinner (Autenticación · 05); `loading` ya evita el doble envío. */}
      <Button
        type="primary"
        htmlType="submit"
        disabled={false}
        block
        loading={submitting}
        className={styles.submit}
        data-testid="login-submit-button"
      >
        {submitting ? 'Ingresando…' : 'Ingresar'}
      </Button>

      {/* En móvil el link queda debajo del botón (Autenticación · 02). */}
      <Link href="/recuperar" className={`${styles.link} ${styles.centered} ${styles.mobileOnly}`} data-testid="login-forgot-link-mobile">
        ¿Olvidaste tu contraseña?
      </Link>

      <p className={styles.footerText}>
        <span className={styles.desktopOnly}>¿Todavía no tenés cuenta? </span>
        <span className={styles.mobileOnly}>¿No tenés cuenta? </span>
        <Link href={registerHref} className={styles.link} data-testid="login-register-link">
          <span className={styles.desktopOnly}>Creá una gratis</span>
          <span className={styles.mobileOnly}>Registrate</span>
        </Link>
      </p>
    </Form>
  )
}
