'use client'

/**
 * AccionSolicitar.tsx — el botón "Solicitar alquiler" del detalle y sus
 * estados (sin sesión, puede solicitar, ya solicitada, propia y no
 * disponible).
 *
 * Diseño: "Detalle de propiedad" · 02 ("Los cuatro estados del botón") y
 * · 04 ("Ya enviaste una solicitud", "Ya está alquilada").
 * Cubre: US-41 Consultar detalle de propiedad y US-35 Enviar solicitud
 * (numeración de Jira).
 * Quién lo usa: la tarjeta del dueño (`variant="tarjeta"`) y la barra fija de
 * móvil (`variant="barra"`), dentro de `DetallePropiedad`.
 */
import Link from 'next/link'
import { Button, Skeleton } from 'antd'
import { CheckCircleFilled } from '@ant-design/icons'
import type { PropiedadDetalle } from '@rentar/shared-types'
import { StatusTag } from '@rentar/ui'
import { formatDate } from '@rentar/ui/src/utils/formatDate'
import { hrefBuscarEnBarrio } from '@/lib/search/busquedaParams'
import { hrefLoginParaSolicitar, type EstadoAccion } from './estadoAccion'
import styles from './AccionSolicitar.module.css'

/** Props de {@link AccionSolicitar}. */
interface AccionSolicitarProps {
  estado: EstadoAccion
  propiedad: Pick<PropiedadDetalle, 'id' | 'neighborhoodSlug' | 'neighborhoodName' | 'status'>
  /** Abre el modal "Solicitar alquiler" (solo en `puede_solicitar`). */
  onSolicitar: () => void
  /**
   * `tarjeta`: completa, con el texto de ayuda y los detalles del estado.
   * `barra`: solo el botón, para la barra fija de móvil (Detalle · 03).
   */
  variant: 'tarjeta' | 'barra'
}

/** Mis solicitudes (se implementa en la tanda 2; hoy es un placeholder). */
const HREF_MIS_SOLICITUDES = '/panel/mis-solicitudes'

/**
 * El botón principal del detalle según {@link EstadoAccion}. Toda acción
 * mantiene 44 px de alto mínimo (Detalle · 03, "Reglas de la vista móvil").
 */
export function AccionSolicitar({ estado, propiedad, onSolicitar, variant }: AccionSolicitarProps) {
  const enTarjeta = variant === 'tarjeta'
  const testid = (nombre: string) => (enTarjeta ? `detalle-propiedad-${nombre}` : `detalle-propiedad-barra-${nombre}`)

  // ─── Render ─────────────────────────────────────────────────────────────

  switch (estado.tipo) {
    case 'cargando':
      return <Skeleton.Button active block className={styles.skeleton} />

    case 'sin_sesion':
      // US-35: "se debe haber iniciado sesión". Va a /login y vuelve con el modal abierto.
      return (
        <div className={styles.block}>
          <Button type="primary" size="large" block href={hrefLoginParaSolicitar(propiedad.id)} className={styles.action} data-testid={testid('solicitar-login-button')}>
            Ingresar para solicitar
          </Button>
          {enTarjeta && <p className={styles.hint}>Te pedimos que ingreses y volvés a esta publicación con el formulario abierto.</p>}
        </div>
      )

    case 'puede_solicitar':
      return (
        <Button type="primary" size="large" block onClick={onSolicitar} className={styles.action} data-testid={testid('solicitar-button')}>
          Solicitar alquiler
        </Button>
      )

    case 'ya_solicitada':
      // Ya no es una acción: es el estado de su solicitud y el link para seguirla (Detalle · 02 y 04).
      // NOTA: sin "Cancelar" acá. El locatario cancela una pendiente desde Mis solicitudes
      // (sin US en Sprint 0, mapa US-39) y el locador cancela una aceptada desde
      // Solicitudes recibidas (US-38).
      if (!enTarjeta) {
        return (
          <Button size="large" block href={HREF_MIS_SOLICITUDES} icon={<CheckCircleFilled />} className={styles.action} data-testid={testid('ver-solicitudes-link')}>
            Solicitud enviada
          </Button>
        )
      }
      return (
        <div className={styles.solicitud} data-testid="detalle-propiedad-solicitud-estado">
          <div className={styles.solicitudHeader}>
            <span className={styles.solicitudTitle}>Tu solicitud</span>
            <StatusTag domain="solicitud" status={estado.solicitud.status} data-testid="detalle-propiedad-solicitud-tag" />
          </div>
          <p className={styles.solicitudText}>Enviada el {formatDate(estado.solicitud.createdAt)}</p>
          <Button size="large" block href={HREF_MIS_SOLICITUDES} className={styles.action} data-testid="detalle-propiedad-ver-solicitudes-link">
            Ver en Mis solicitudes
          </Button>
        </div>
      )

    case 'propia':
      return (
        <div className={styles.block}>
          <Button size="large" block disabled className={styles.action} data-testid={testid('propia')}>
            Es tu publicación
          </Button>
          {enTarjeta && (
            <p className={styles.hint}>
              Las solicitudes que recibas las vas a ver en tu panel. <Link href="/panel/propiedades">Ir a Mis propiedades</Link>
            </p>
          )}
        </div>
      )

    case 'no_disponible':
      // Detalle · 04 ("Ya está alquilada"): el foco pasa a las propiedades del mismo barrio.
      return (
        <div className={styles.block} data-testid={enTarjeta ? 'detalle-propiedad-no-disponible' : undefined}>
          {enTarjeta && (
            <div className={styles.noDisponible}>
              <StatusTag domain="propiedad" status={propiedad.status} />
              <p className={styles.hint}>Ya no está disponible: esta propiedad no recibe solicitudes.</p>
            </div>
          )}
          <Button type="primary" size="large" block href={hrefBuscarEnBarrio(propiedad.neighborhoodSlug)} className={styles.action} data-testid={testid('ver-similares-button')}>
            {propiedad.neighborhoodName ? `Ver propiedades en ${propiedad.neighborhoodName}` : 'Ver otras propiedades'}
          </Button>
        </div>
      )
  }
}
