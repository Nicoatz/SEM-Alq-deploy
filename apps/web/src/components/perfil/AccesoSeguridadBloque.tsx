'use client'

/**
 * AccesoSeguridadBloque.tsx — el bloque "Acceso y seguridad" de "Mi perfil".
 *
 * Qué es: con qué correo se entra y el cambio de contraseña.
 * Cubre:
 * - US-20 Consultar usuario: el correo de acceso.
 * - US-21 Modificar usuario: "para cambiar la contraseña se deben ingresar
 *   la contraseña actual, la nueva y su confirmación"; la nueva cumple las
 *   reglas de US-19 y es distinta de la actual; indicador de seguridad. Se
 *   guarda solo, con Guardar y Cancelar.
 * De dónde saca los datos: `PerfilUsuario.email` (lo pasa `PerfilScreen`);
 * cambia la contraseña con `perfil.service#cambiarContrasena` (Supabase
 * verifica la actual: ver el BLOQUEANTE en ese service).
 * Quién lo usa: `PerfilScreen.tsx`.
 *
 * NOTA de privacidad: las contraseñas viven solo en el formulario; al
 * guardar o cancelar se desmonta y se borran.
 */
import { useEffect, useState } from 'react'
import { Alert, Button, Form, Input } from 'antd'
import { DetailList, PasswordStrengthMeter } from '@rentar/ui'
import { fuerzaPassword, reglasPasswordActual, reglasPasswordCambio, reglasPasswordRepetida, requisitosPassword } from '@/lib/validation/usuario.rules'
import { cambiarContrasena } from '@/services/perfil.service'
import { ServiceError } from '@/services/shared/errors'
import { BloquePerfil } from './BloquePerfil'
import styles from './BloquesPerfil.module.css'

/** Props de {@link AccesoSeguridadBloque}. */
interface AccesoSeguridadBloqueProps {
  email: string
  /** Avisa si hay algo escrito sin guardar (para el aviso de salida, US-21). */
  onCambiosSinGuardar: (hayCambios: boolean) => void
}

/** Los campos del formulario de contraseña. */
interface ValoresContrasena {
  actual: string
  nueva: string
  repetida: string
}

/** Props de {@link FormularioContrasena}. */
interface FormularioContrasenaProps {
  onGuardado: () => void
  onCancelar: () => void
  onCambiosSinGuardar: (hayCambios: boolean) => void
}

/** El formulario de cambio de contraseña, con su propio `Form.useForm`. */
function FormularioContrasena({ onGuardado, onCancelar, onCambiosSinGuardar }: FormularioContrasenaProps) {
  const [form] = Form.useForm<ValoresContrasena>()
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const valores = Form.useWatch([], form) as Partial<ValoresContrasena> | undefined
  const nueva = valores?.nueva ?? ''
  const hayCambios = Boolean(valores?.actual || valores?.nueva || valores?.repetida)

  useEffect(() => {
    onCambiosSinGuardar(hayCambios)
  }, [hayCambios, onCambiosSinGuardar])
  useEffect(() => () => onCambiosSinGuardar(false), [onCambiosSinGuardar])

  // ─── Handlers ───────────────────────────────────────────────────────
  async function guardar({ actual, nueva: nuevaForm }: ValoresContrasena): Promise<void> {
    setGuardando(true)
    setError(null)
    try {
      await cambiarContrasena({ actual, nueva: nuevaForm })
      onGuardado()
    } catch (excepcion) {
      const mensaje = excepcion instanceof ServiceError ? excepcion.message : 'No pudimos cambiar la contraseña. Probá de nuevo.'
      // La contraseña actual incorrecta se marca en su campo (US-21).
      if (excepcion instanceof ServiceError && excepcion.apiCode === 'current_password_invalid') {
        form.setFields([{ name: 'actual', errors: [mensaje] }])
      } else {
        setError(mensaje)
      }
      setGuardando(false)
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────
  return (
    <Form<ValoresContrasena> form={form} layout="vertical" onFinish={guardar} requiredMark={false} disabled={guardando} data-testid="perfil-password-form">
      {error && <Alert type="error" showIcon title={error} className={styles.formAlert} data-testid="perfil-password-error" />}
      <Form.Item name="actual" label="Contraseña actual" rules={reglasPasswordActual}>
        <Input.Password autoComplete="current-password" data-testid="perfil-password-actual" />
      </Form.Item>
      <div className={styles.grid}>
        <Form.Item name="nueva" label="Contraseña nueva" rules={reglasPasswordCambio('actual')} dependencies={['actual']}>
          <Input.Password autoComplete="new-password" aria-describedby="perfil-password-fuerza" data-testid="perfil-password-nueva" />
        </Form.Item>
        <Form.Item name="repetida" label="Repetí la contraseña nueva" rules={reglasPasswordRepetida('nueva')} dependencies={['nueva']}>
          <Input.Password autoComplete="new-password" visibilityToggle={false} data-testid="perfil-password-repetir" />
        </Form.Item>
      </div>
      {/* US-21: "se debe mostrar el indicador de seguridad de la contraseña nueva" (mismo que US-19). */}
      <PasswordStrengthMeter id="perfil-password-fuerza" strength={fuerzaPassword(nueva)} requirements={requisitosPassword(nueva)} data-testid="perfil-password-fuerza" />
      <div className={`${styles.actions} ${styles.actionsSeparadas}`}>
        <Button type="primary" htmlType="submit" loading={guardando} data-testid="perfil-password-guardar">
          Cambiar la contraseña
        </Button>
        <Button onClick={onCancelar} disabled={guardando} data-testid="perfil-password-cancelar">
          Cancelar
        </Button>
      </div>
    </Form>
  )
}

/** Acceso a la cuenta y cambio de contraseña. */
export function AccesoSeguridadBloque({ email, onCambiosSinGuardar }: AccesoSeguridadBloqueProps) {
  const [editando, setEditando] = useState(false)
  const [exito, setExito] = useState<string | null>(null)

  return (
    <BloquePerfil testId="perfil-acceso" title="Acceso y seguridad" description="Con estos datos entrás a RentAR.">
      <div className={styles.stack}>
        {exito && !editando && (
          <Alert type="success" showIcon closable={{ 'aria-label': 'Cerrar el aviso' }} onClose={() => setExito(null)} title={exito} data-testid="perfil-password-exito" />
        )}
        <DetailList
          items={[
            { label: 'Correo para entrar', value: email },
            { label: 'Contraseña', value: '••••••••' },
          ]}
          column={1}
        />
        {!editando ? (
          <div className={styles.actions}>
            <Button
              onClick={() => {
                setExito(null)
                setEditando(true)
              }}
              data-testid="perfil-password-editar"
            >
              Cambiar la contraseña
            </Button>
          </div>
        ) : (
          <FormularioContrasena
            onGuardado={() => {
              setEditando(false)
              setExito('Cambiamos tu contraseña. La próxima vez entrá con la nueva.')
            }}
            onCancelar={() => setEditando(false)}
            onCambiosSinGuardar={onCambiosSinGuardar}
          />
        )}
      </div>
    </BloquePerfil>
  )
}
