'use client'

/**
 * RecientesEstados.tsx — los estados de "Recién publicadas" sin tarjetas:
 * error (el back no respondió) y vacío (no hay ninguna publicada).
 *
 * Cubre: US-34 Consultar propiedades a alquilar (vista previa).
 * De dónde saca los datos: ninguno; "Reintentar" vuelve a pedir la página
 * al servidor (`router.refresh()`), que es quien llama al service.
 * Quién lo usa: `Recientes.tsx`.
 */
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from 'antd'
import { ExclamationOutlined, HomeOutlined } from '@ant-design/icons'
import { EmptyState } from '@rentar/ui'
import styles from './Recientes.module.css'

/** Ruta del alta (US-01): sin sesión, `proxy.ts` la manda a `/login?next=…`. */
const PUBLICAR_PATH = '/panel/propiedades/nueva'

/**
 * El back no respondió. Mismo bloque que el error de `/buscar`.
 * NOTA: no dice "no hay propiedades": sería mentirle a quien busca.
 */
export function RecientesError() {
  const router = useRouter()
  // La transición marca el botón como cargando mientras el servidor vuelve a pedir los datos.
  const [reintentando, startReintento] = useTransition()

  return (
    <div className={styles.errorBlock} role="alert" data-testid="landing-error">
      <span className={styles.errorIcon} aria-hidden="true">
        <ExclamationOutlined />
      </span>
      <span className={styles.errorTitle}>No pudimos traer las propiedades</span>
      <span className={styles.errorText}>Puede ser un problema momentáneo de conexión. Probá de nuevo en un momento.</span>
      <Button type="primary" loading={reintentando} onClick={() => startReintento(() => router.refresh())} data-testid="landing-reintentar">
        Reintentar
      </Button>
    </div>
  )
}

/** Todavía no hay ninguna propiedad publicada. */
export function RecientesVacio() {
  return (
    <EmptyState
      icon={<HomeOutlined />}
      title="Todavía no hay propiedades publicadas"
      description="Cuando un dueño publique, la vas a ver acá."
      action={
        <Button type="primary" href={PUBLICAR_PATH} data-testid="landing-sin-propiedades-publicar">
          Publicar propiedad
        </Button>
      }
      data-testid="landing-sin-propiedades"
    />
  )
}
