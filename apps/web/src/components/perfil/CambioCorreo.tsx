'use client'

/**
 * CambioCorreo.tsx — cambiar el correo desde "Datos personales".
 *
 * Qué es: el pedido de cambio de correo y su estado "pendiente de
 * confirmación". El correo nuevo NO se aplica al guardar: se aplica cuando
 * el usuario confirma los enlaces que le manda Supabase ("Secure email
 * change" activo, decisión del PO: llegan dos, uno al correo actual y otro
 * al nuevo). Hasta entonces sigue vigente el anterior.
 * Cubre: US-21 Modificar usuario ("el cambio solo se aplica cuando el
 * usuario confirma el nuevo correo desde el enlace que se le envía").
 * De dónde saca los datos: `PerfilUsuario.email` y `pendingEmail`; pide el
 * cambio con `perfil.service#solicitarCambioDeCorreo`. En modo mock, el
 * botón "Simular confirmación" (`simularConfirmacionDeCorreo`) hace de enlace.
 * Quién lo usa: `DatosPersonalesBloque.tsx` (al final del bloque).
 */
import { useEffect, useState } from 'react'
import { Alert, Button, Form, Input } from 'antd'
import type { PerfilUsuario } from '@rentar/shared-types'
import { useAuth } from '@/lib/auth/AuthProvider'
import { reglasEmailSolicitud } from '@/lib/validation/solicitud.rules'
import { PUEDE_SIMULAR_CONFIRMACION_DE_CORREO, simularConfirmacionDeCorreo, solicitarCambioDeCorreo } from '@/services/perfil.service'
import { ServiceError } from '@/services/shared/errors'
import styles from './BloquesPerfil.module.css'

/** Props de {@link CambioCorreo}. */
interface CambioCorreoProps {
  perfil: PerfilUsuario
  /** El perfil cambió (correo pendiente o confirmado). */
  onActualizado: (perfil: PerfilUsuario) => void
  /** Avisa si hay un correo escrito sin enviar (para el aviso de salida, US-21). */
  onCambiosSinGuardar: (hayCambios: boolean) => void
}

/** Texto del pendiente, como lo fijó el PO. */
function textoPendiente(correoNuevo: string): string {
  return `Te mandamos un enlace a tu correo actual y otro a ${correoNuevo}. El cambio se aplica cuando confirmes los dos.`
}

/** Pedido de cambio de correo y su estado pendiente. */
export function CambioCorreo({ perfil, onActualizado, onCambiosSinGuardar }: CambioCorreoProps) {
  const { refrescarUsuario } = useAuth()
  const [form] = Form.useForm<{ email: string }>()

  // ─── Estado local ───────────────────────────────────────────────────
  const [editando, setEditando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)
  const escrito = (Form.useWatch('email', form) ?? '').trim()
  const hayCambios = editando && escrito !== '' && escrito.toLowerCase() !== perfil.email.toLowerCase()

  useEffect(() => {
    onCambiosSinGuardar(hayCambios)
  }, [hayCambios, onCambiosSinGuardar])

  // ─── Handlers ───────────────────────────────────────────────────────
  function cancelar(): void {
    form.resetFields()
    setError(null)
    setEditando(false)
  }

  async function enviar({ email }: { email: string }): Promise<void> {
    setEnviando(true)
    setError(null)
    try {
      const pendiente = await solicitarCambioDeCorreo(email)
      onActualizado({ ...perfil, pendingEmail: pendiente })
      form.resetFields()
      setEditando(false)
      setExito(null)
    } catch (excepcion) {
      const mensaje = excepcion instanceof ServiceError ? excepcion.message : 'No pudimos pedir el cambio. Probá de nuevo.'
      form.setFields([{ name: 'email', errors: [mensaje] }])
    } finally {
      setEnviando(false)
    }
  }

  /** Solo modo mock: hace de los dos enlaces del correo. */
  async function simularConfirmacion(): Promise<void> {
    setEnviando(true)
    setError(null)
    try {
      onActualizado(await simularConfirmacionDeCorreo())
      setExito('Confirmaste el cambio: desde ahora entrás con tu correo nuevo.')
      void refrescarUsuario()
    } catch (excepcion) {
      setError(excepcion instanceof ServiceError ? excepcion.message : 'No pudimos confirmar el cambio.')
    } finally {
      setEnviando(false)
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────
  return (
    <div className={styles.stack} data-testid="perfil-email-cambio">
      {exito && <Alert type="success" showIcon closable={{ 'aria-label': 'Cerrar el aviso' }} onClose={() => setExito(null)} title={exito} data-testid="perfil-email-exito" />}

      {/* El error del pedido va en el campo; acá, el de la confirmación simulada. */}
      {error && !editando && <Alert type="error" showIcon title={error} data-testid="perfil-email-error" />}

      {perfil.pendingEmail && (
        <div className={`${styles.notice} ${styles.noticeWarning}`} data-testid="perfil-email-pendiente">
          <span className={styles.noticeTitle}>Cambio de correo pendiente de confirmación</span>
          <span>{textoPendiente(perfil.pendingEmail)}</span>
          <span>
            Mientras tanto seguís entrando con <strong>{perfil.email}</strong>.
          </span>
          {PUEDE_SIMULAR_CONFIRMACION_DE_CORREO && (
            <div className={styles.noticeActions}>
              <Button size="small" onClick={simularConfirmacion} loading={enviando} data-testid="perfil-email-simular-confirmacion">
                Simular confirmación (modo de prueba)
              </Button>
            </div>
          )}
        </div>
      )}

      {!editando ? (
        <div className={styles.actions}>
          <Button
            onClick={() => {
              setExito(null)
              setEditando(true)
            }}
            data-testid="perfil-email-cambiar"
          >
            {perfil.pendingEmail ? 'Pedir el cambio a otro correo' : 'Cambiar correo'}
          </Button>
        </div>
      ) : (
        <Form form={form} layout="vertical" onFinish={enviar} requiredMark={false} disabled={enviando} data-testid="perfil-email-form">
          <Form.Item name="email" label="Correo nuevo" rules={reglasEmailSolicitud} extra="Te vamos a mandar un enlace para confirmarlo.">
            <Input inputMode="email" autoComplete="email" data-testid="perfil-email-input" />
          </Form.Item>
          <div className={styles.actions}>
            <Button type="primary" htmlType="submit" loading={enviando} data-testid="perfil-email-enviar">
              Enviar enlace
            </Button>
            <Button onClick={cancelar} disabled={enviando} data-testid="perfil-email-cancelar">
              Cancelar
            </Button>
          </div>
        </Form>
      )}
    </div>
  )
}
