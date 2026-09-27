'use client'

/**
 * RegistroForm.tsx — `/registro` completo (US-19 Registrar usuario).
 *
 * Qué es: el registro en un solo paso, "Tus datos": nombre, apellido, fecha
 * de nacimiento, DNI, teléfono, email, contraseña (con indicador de fuerza),
 * repetir contraseña y términos. Después inicia sesión solo (ver
 * `iniciarSesionAutomatica`) y muestra "Cuenta creada" con "Buscar
 * propiedades" y "Publicar una propiedad".
 * Diseño: Claude Design, "Autenticación" · 03 (tus datos) y 05 (estados).
 *
 * NOTA: no se elige rol (regla del equipo, 27/09/2026). Toda cuenta nueva es
 * locataria; al publicar su primera propiedad el back le suma el rol locador
 * (ver `propiedades.service.ts#registrarPropiedad`).
 *
 * De dónde saca los datos: `services/auth.service.ts#registrarUsuario` y,
 * para el login automático, `useAuth().login`.
 * Quién lo usa: `app/(auth)/registro/page.tsx`.
 */
import { useState } from 'react'
import Link from 'next/link'
import { Button, Checkbox, DatePicker, Form, Input } from 'antd'
import type { Dayjs } from 'dayjs'
import type { UsuarioSesion } from '@rentar/shared-types'
import { AuthLayout, PasswordStrengthMeter, SimulatedFeatureNotice } from '@rentar/ui'
import {
  fuerzaPassword,
  reglasApellido,
  reglasDni,
  reglasEmail,
  reglasFechaNacimiento,
  reglasNombre,
  reglasPasswordNueva,
  reglasPasswordRepetida,
  reglasTelefono,
  reglasTerminos,
  requisitosPassword,
  soloDigitos,
} from '@/lib/validation/usuario.rules'
import { useAuth } from '@/lib/auth/AuthProvider'
import { hoy } from '@/lib/utils/fechas'
import { registrarUsuario } from '@/services/auth.service'
import { USE_MOCKS } from '@/services/shared/config'
import { ServiceError } from '@/services/shared/errors'
import { FormAlert } from './FormAlert'
import { isServerError, serverErrorCopy, type ServerErrorCopy } from './serverError'
import { StatusBlock } from './StatusBlock'
import { TerminosModal, type DocumentoLegal } from './TerminosModal'
import styles from './AuthForm.module.css'

type Step = 'datos' | 'listo'

interface DatosFormValues {
  nombre: string
  apellido: string
  fechaNacimiento: Dayjs
  dni: string
  telefono: string
  email: string
  password: string
  passwordRepetida: string
  aceptaTerminos: boolean
}

interface RegistroFormProps {
  /** Ruta interna a la que se quería ir antes de registrarse, si había. */
  next: string | null
}

/** Registro de usuario en un paso, con los estados de carga, error y éxito. */
export function RegistroForm({ next }: RegistroFormProps) {
  const [form] = Form.useForm<DatosFormValues>()
  const { login } = useAuth()

  // ─── Estado local ───────────────────────────────────────────────────
  const [step, setStep] = useState<Step>('datos')
  const [submitting, setSubmitting] = useState(false)
  const [emailTaken, setEmailTaken] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<ServerErrorCopy | null>(null)
  const [nombreCreado, setNombreCreado] = useState('')
  const [emailCreado, setEmailCreado] = useState('')
  // Usuario con la sesión ya iniciada por el login automático; `null` si falló.
  const [sesionIniciada, setSesionIniciada] = useState<UsuarioSesion | null>(null)
  const [documentoAbierto, setDocumentoAbierto] = useState<DocumentoLegal | null>(null)

  const password = Form.useWatch('password', form) ?? ''
  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : '/login'

  // ─── Handlers ───────────────────────────────────────────────────────

  async function handleSubmit(values: DatosFormValues): Promise<void> {
    setSubmitting(true)
    setEmailTaken(false)
    setFormError(null)
    setServerError(null)
    try {
      const usuario = await registrarUsuario({
        nombre: values.nombre,
        apellido: values.apellido,
        email: values.email,
        password: values.password,
        telefono: soloDigitos(values.telefono),
        dni: soloDigitos(values.dni),
        fechaNacimiento: values.fechaNacimiento.format('YYYY-MM-DD'),
        aceptaTerminos: values.aceptaTerminos,
      })
      setNombreCreado(usuario.nombre)
      setEmailCreado(usuario.email)
      setSesionIniciada(await iniciarSesionAutomatica(values.email, values.password))
      setStep('listo')
    } catch (error) {
      if (error instanceof ServiceError && error.code === 'conflict') {
        // Mail duplicado (lo decide el service): aviso arriba y el campo marcado.
        setEmailTaken(true)
        form.setFields([{ name: 'email', errors: [error.message] }])
      } else if (!isServerError(error) && error instanceof ServiceError) {
        // El back rechazó algún dato (400): se muestra su mensaje arriba del
        // formulario, que queda con lo escrito para corregirlo.
        setFormError(error.message)
      } else {
        setServerError(serverErrorCopy(error))
      }
    } finally {
      setSubmitting(false)
    }
  }

  /**
   * Login automático después de crear la cuenta: el back la crea ya
   * confirmada (`email_confirm: true`), así que se puede entrar enseguida con
   * las mismas credenciales. Las credenciales se usan solo para este pedido:
   * no se guardan en ningún lado.
   *
   * NOTA: si falla (sin red, Auth caído), NO es un error del registro —la
   * cuenta ya existe—: devuelve `null` y la pantalla de éxito manda por
   * /login con el email cargado, como antes de conectar el back.
   */
  async function iniciarSesionAutomatica(email: string, passwordIngresada: string): Promise<UsuarioSesion | null> {
    try {
      return await login({ email, password: passwordIngresada })
    } catch {
      return null
    }
  }

  /** "Reintentar": vuelve a enviar lo que ya estaba escrito (el form conserva los valores). */
  function handleRetry(): void {
    setServerError(null)
    void handleSubmit(form.getFieldsValue(true))
  }

  // ─── Render: cuenta creada ──────────────────────────────────────────

  function renderListo() {
    // Diseño (Autenticación · 05, "Cuenta creada"): igual para todos, buscar
    // (principal) o publicar (secundario). Al publicar la primera propiedad la
    // cuenta pasa a ser también de locador.
    // NOTA: el registro inicia sesión solo (ver `iniciarSesionAutomatica`),
    // así que "Publicar una propiedad" lleva directo al alta. Si el login
    // automático falló, pasa por /login con el email ya cargado (solo falta
    // la contraseña) y vuelve al alta con ?next=. Buscar no pide sesión.
    const altaHref = sesionIniciada
      ? '/panel/propiedades/nueva'
      : `/login?next=${encodeURIComponent('/panel/propiedades/nueva')}&email=${encodeURIComponent(emailCreado)}`
    return (
      <StatusBlock
        variant="success"
        title={`¡Listo, ${nombreCreado}!`}
        description="Tu cuenta ya está activa. Te mandamos un email para confirmar la dirección."
        actions={
          <>
            <Button type="primary" size="large" href="/buscar" className={`${styles.submit} ${styles.successButton}`} data-testid="registro-success-buscar">
              Buscar propiedades
            </Button>
            <Button size="large" href={altaHref} className={`${styles.secondaryButton} ${styles.successButton}`} data-testid="registro-success-publicar">
              Publicar una propiedad
            </Button>
            {/* El texto de arriba es el del diseño; este aviso aclara que el email
                no sale: ni el mock ni el back mandan emails (el back crea la
                cuenta ya confirmada). docs/PRODUCT.md: nunca simular sin decirlo.
                En modo mock queda el motivo por defecto ("no hay backend
                conectado"); con el back real, ese motivo ya no es cierto. */}
            <SimulatedFeatureNotice
              feature="el email de confirmación"
              reason={USE_MOCKS ? undefined : 'El servidor todavía no envía emails de confirmación.'}
              data-testid="registro-email-simulado"
            />
          </>
        }
        data-testid="registro-success"
      />
    )
  }

  // ─── Render: tus datos ──────────────────────────────────────────────

  function renderStepDatos() {
    return (
      <>
        {serverError && (
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
        )}
        <div hidden={serverError !== null}>
          <Form<DatosFormValues>
            form={form}
            layout="vertical"
            requiredMark={false}
            // RNF-09 / diseño: se valida al salir de cada campo y de nuevo al
            // enviar; al enviar, el foco salta al primer campo con error.
            validateTrigger="onBlur"
            scrollToFirstError={{ focus: true, block: 'center' }}
            disabled={submitting}
            onFinish={handleSubmit}
            initialValues={{ aceptaTerminos: false }}
            className={styles.form}
            data-testid="registro-form"
          >
            {emailTaken && (
              <FormAlert
                title="Ya existe una cuenta con ese email"
                description={
                  <>
                    <Link href={loginHref}>Iniciar sesión</Link> o <Link href="/recuperar">recuperar contraseña</Link>.
                  </>
                }
                data-testid="registro-email-taken-alert"
              />
            )}
            {formError && <FormAlert title="Revisá los datos" description={formError} data-testid="registro-error-alert" />}

            <Form.Item label="Nombre" name="nombre" rules={reglasNombre}>
              <Input autoComplete="given-name" data-testid="registro-nombre-input" />
            </Form.Item>

            <Form.Item label="Apellido" name="apellido" rules={reglasApellido}>
              <Input autoComplete="family-name" data-testid="registro-apellido-input" />
            </Form.Item>

            <Form.Item
              label="Fecha de nacimiento"
              name="fechaNacimiento"
              rules={reglasFechaNacimiento}
              extra="Tenés que ser mayor de 18 años para firmar un contrato."
              validateTrigger={['onBlur', 'onChange']}
            >
              <DatePicker
                format="DD/MM/YYYY"
                placeholder="dd/mm/aaaa"
                disabledDate={(date) => date.isAfter(hoy(), 'day')}
                data-testid="registro-fecha-nacimiento-input"
              />
            </Form.Item>

            <Form.Item label="DNI" name="dni" rules={reglasDni} extra="Sin puntos ni guiones, como figura en tu documento.">
              <Input inputMode="numeric" data-testid="registro-dni-input" />
            </Form.Item>

            <Form.Item label="Teléfono" name="telefono" rules={reglasTelefono} extra="Con característica, sin el 0 y sin el 15.">
              <Input type="tel" inputMode="tel" autoComplete="tel-national" data-testid="registro-telefono-input" />
            </Form.Item>

            <Form.Item label="Email" name="email" rules={reglasEmail}>
              <Input type="email" autoComplete="email" inputMode="email" data-testid="registro-email-input" />
            </Form.Item>

            <Form.Item label="Contraseña" name="password" rules={reglasPasswordNueva} validateTrigger={['onBlur']}>
              <Input.Password autoComplete="new-password" aria-describedby="registro-password-fuerza" data-testid="registro-password-input" />
            </Form.Item>
            <div className={styles.meter}>
              <PasswordStrengthMeter
                id="registro-password-fuerza"
                strength={fuerzaPassword(password)}
                requirements={requisitosPassword(password)}
                data-testid="registro-password-strength"
              />
            </div>

            <Form.Item label="Repetir contraseña" name="passwordRepetida" dependencies={['password']} rules={reglasPasswordRepetida('password')}>
              <Input.Password autoComplete="new-password" visibilityToggle={false} data-testid="registro-password-repetida-input" />
            </Form.Item>

            <Form.Item name="aceptaTerminos" valuePropName="checked" rules={reglasTerminos} validateTrigger={['onChange']}>
              <Checkbox className={`${styles.checkbox} ${styles.checkboxTop}`} data-testid="registro-terminos-checkbox">
                Acepto los{' '}
                <button type="button" className={styles.linkButton} onClick={() => setDocumentoAbierto('terminos')} data-testid="registro-terminos-link">
                  Términos y condiciones
                </button>{' '}
                y la{' '}
                <button type="button" className={styles.linkButton} onClick={() => setDocumentoAbierto('privacidad')} data-testid="registro-privacidad-link">
                  Política de privacidad
                </button>{' '}
                de RentAR.
              </Checkbox>
            </Form.Item>

            <div className={styles.buttonRow}>
              {/* disabled={false}: mismo motivo que en LoginForm (el botón se ve azul con el spinner). */}
              <Button
                type="primary"
                htmlType="submit"
                disabled={false}
                loading={submitting}
                className={styles.submit}
                data-testid="registro-submit-button"
              >
                {submitting ? 'Creando tu cuenta…' : 'Crear mi cuenta'}
              </Button>
            </div>

            {/* Estaba en el paso 1 (que ya no existe); se mantiene para quien ya tiene cuenta. */}
            <p className={styles.footerText}>
              ¿Ya tenés cuenta?{' '}
              <Link href={loginHref} className={styles.link} data-testid="registro-login-link">
                Iniciá sesión
              </Link>
            </p>

            <TerminosModal documento={documentoAbierto} onClose={() => setDocumentoAbierto(null)} />
          </Form>
        </div>
      </>
    )
  }

  // ─── Render ─────────────────────────────────────────────────────────

  return (
    <AuthLayout title={step === 'listo' ? 'Cuenta creada' : 'Tus datos'} data-testid="registro-page">
      {step === 'datos' && renderStepDatos()}
      {step === 'listo' && renderListo()}
    </AuthLayout>
  )
}
