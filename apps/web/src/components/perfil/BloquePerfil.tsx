'use client'

/**
 * BloquePerfil.tsx — la tarjeta de cada bloque de "Mi perfil".
 *
 * Qué es: el contenedor común de Datos personales, Legajo, Acceso y
 * seguridad y Mis roles. Adentro usa `FormSection` de `@rentar/ui` (título y
 * descripción). En escritorio el bloque está siempre abierto; en móvil el
 * encabezado es un botón que lo pliega y despliega (US-20: "en móvil, cada
 * bloque se puede desplegar y plegar"; el diseño los dibuja como filas).
 * Cubre: US-20 Consultar usuario.
 * Quién lo usa: `components/perfil/*Bloque.tsx`.
 */
import { useState, type ReactNode } from 'react'
import { DownOutlined } from '@ant-design/icons'
import { Grid } from 'antd'
import { FormSection } from '@rentar/ui'
import styles from './BloquePerfil.module.css'

/** Props de {@link BloquePerfil}. */
interface BloquePerfilProps {
  /** Prefijo de los `data-testid` (ej. `perfil-datos`). */
  testId: string
  title: string
  description?: string
  /** Algo chico al lado del título en móvil (ej. "2 de 3" del legajo). */
  badge?: ReactNode
  /** Si arranca abierto en móvil. En escritorio siempre está abierto. */
  defaultOpen?: boolean
  children: ReactNode
}

/** Tarjeta de un bloque del perfil, plegable en móvil. */
export function BloquePerfil({ testId, title, description, badge, defaultOpen = false, children }: BloquePerfilProps) {
  // `md` = 768 px o más. Mientras antd no midió la pantalla (primer render),
  // se trata como escritorio: el bloque se ve abierto.
  const pantalla = Grid.useBreakpoint()
  const esMovil = pantalla.md === false
  const [abierto, setAbierto] = useState(defaultOpen)
  const visible = !esMovil || abierto
  const idContenido = `${testId}-contenido`

  return (
    <div className={styles.card} data-testid={testId}>
      {esMovil && (
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={abierto}
          aria-controls={idContenido}
          onClick={() => setAbierto((actual) => !actual)}
          data-testid={`${testId}-toggle`}
        >
          <span className={styles.toggleTitle}>{title}</span>
          <span className={styles.toggleEnd}>
            {badge}
            <DownOutlined className={abierto ? styles.chevronOpen : styles.chevron} aria-hidden />
          </span>
        </button>
      )}
      {/* NOTA: plegado se oculta con `hidden`, sin desmontar, y el árbol es el
          mismo en móvil y en escritorio: si el bloque estaba en edición, lo
          escrito no se pierde al plegarlo ni al rotar el teléfono. En móvil
          el título lo muestra el botón, así que se oculta el de FormSection. */}
      <div id={idContenido} className={esMovil ? styles.bodyMobile : undefined} hidden={!visible}>
        <FormSection title={title} description={description}>
          {children}
        </FormSection>
      </div>
    </div>
  )
}
