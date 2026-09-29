'use client'

/**
 * RevisandoSesion.tsx — lo que se ve en `/login` y `/registro` mientras se
 * confirma si ya hay sesión (y, si la hay, mientras se redirige).
 *
 * Por qué existe: con sesión, esas pantallas llevan a `/panel`. Sin esto, el
 * formulario aparecía un instante y después se iba (parpadeo).
 * Cubre: US-39 Iniciar y cerrar sesión.
 * Quién lo usa: `LoginForm` y `RegistroForm`.
 */
import { Spin } from 'antd'
import styles from './AuthForm.module.css'

/** Spinner centrado con "Revisando tu sesión…". */
export function RevisandoSesion() {
  return (
    <div className={styles.revisando} role="status" data-testid="auth-revisando-sesion">
      <Spin />
      <span>Revisando tu sesión…</span>
    </div>
  )
}
