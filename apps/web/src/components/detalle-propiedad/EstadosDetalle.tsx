'use client'

/**
 * EstadosDetalle.tsx — los estados de `/propiedad/[id]` que no son la
 * propiedad: cargando, publicación inexistente (404) y error de red.
 *
 * Diseño: "Detalle de propiedad" · 04 ("Cargando" y "Error y publicación
 * inexistente").
 * Cubre: US-41 Consultar detalle de propiedad (numeración de Jira).
 * Quién lo usa: `DetallePropiedad` y el `Suspense` de `app/(public)/propiedad/[id]/page.tsx`.
 */
import { Button, Skeleton } from 'antd'
import styles from './DetallePropiedad.module.css'

// ─── Cargando ───────────────────────────────────────────────────────────

/**
 * Skeleton con la silueta real: galería, franja de precio, título y tarjeta
 * del dueño. "Nada de spinner a pantalla completa" (Detalle · 04).
 */
export function DetalleCargando() {
  return (
    <div className={styles.page} aria-busy="true" aria-label="Cargando la propiedad" data-testid="detalle-propiedad-cargando">
      <div className={styles.inner}>
        <Skeleton active title={{ width: '40%' }} paragraph={false} />
        <div className={styles.layout}>
          <div className={styles.main}>
            <Skeleton.Node active className={styles.skeletonGallery}>
              <span />
            </Skeleton.Node>
            <Skeleton active title={{ width: '70%' }} paragraph={{ rows: 1, width: '50%' }} />
            <div className={styles.skeletonStrip}>
              <Skeleton.Button active block />
              <Skeleton.Button active block />
              <Skeleton.Button active block />
            </div>
            <Skeleton active paragraph={{ rows: 4 }} />
          </div>
          <aside className={styles.aside}>
            <div className={styles.skeletonCard}>
              <Skeleton avatar active paragraph={{ rows: 1 }} />
              <Skeleton.Button active block />
              <Skeleton.Button active block />
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

// ─── No existe / error de red ───────────────────────────────────────────

/** Props de {@link DetalleNoDisponible}. */
interface DetalleNoDisponibleProps {
  /**
   * `no_encontrada`: 404 (no existe, la dieron de baja o el link está vencido).
   * `error`: falló la red o el servidor, no el recurso: se ofrece "Reintentar".
   */
  motivo: 'no_encontrada' | 'error'
  onReintentar?: () => void
}

/**
 * "Esta publicación ya no está disponible" (404) o "No pudimos cargar la
 * propiedad" (red), con el mismo bloque (Detalle · 04).
 * NOTA: el diseño ofrece "Buscar en Güemes"; con un 404 no se sabe el barrio,
 * así que el atajo es a `/buscar`.
 */
export function DetalleNoDisponible({ motivo, onReintentar }: DetalleNoDisponibleProps) {
  const esError = motivo === 'error'
  return (
    <div className={styles.page}>
      <div className={styles.stateBlock} role={esError ? 'alert' : undefined} data-testid={esError ? 'detalle-propiedad-error' : 'detalle-propiedad-no-encontrada'}>
        <span className={styles.stateIcon} aria-hidden="true">
          !
        </span>
        <h1 className={styles.stateTitle}>{esError ? 'No pudimos cargar la propiedad' : 'Esta publicación ya no está disponible'}</h1>
        <p className={styles.stateText}>
          {esError ? 'Puede ser un problema momentáneo de conexión. Probá de nuevo en un momento.' : 'El dueño la dio de baja o el enlace está vencido.'}
        </p>
        <div className={styles.stateActions}>
          {esError ? (
            <Button type="primary" size="large" onClick={onReintentar} data-testid="detalle-propiedad-reintentar-button">
              Reintentar
            </Button>
          ) : (
            <Button type="primary" size="large" href="/buscar" data-testid="detalle-propiedad-buscar-button">
              Buscar propiedades
            </Button>
          )}
          <Button size="large" href={esError ? '/buscar' : '/'} data-testid="detalle-propiedad-volver-button">
            {esError ? 'Volver a buscar' : 'Ir al inicio'}
          </Button>
        </div>
      </div>
    </div>
  )
}
