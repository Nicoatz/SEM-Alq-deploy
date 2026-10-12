'use client'

/**
 * OwnerCard.tsx — tarjeta del dueño en el detalle de la propiedad: quién
 * publica, la acción principal ("Solicitar alquiler" y sus estados) y
 * "Enviar mensaje".
 *
 * Diseño: "Detalle de propiedad" · 01 (tarjeta sticky a la derecha) y · 03
 * (en móvil, completa arriba de "Propiedades similares").
 * Cubre: US-41 Consultar detalle de propiedad (numeración de Jira).
 * Datos: `PropiedadDetalle.owner` (`propiedades.service#getPropiedad`). Con el
 * back real llega en `null` (TODO(backend)): la tarjeta dice "El dueño".
 * Quién lo usa: `DetallePropiedad`.
 *
 * NOTA: es un componente local de `apps/web`, armado con `Card` y `Avatar`
 * de antd. El diseño lo presenta como componente nuevo del design system;
 * queda anotado en `.design-sync/NOTES.md` como candidato a pasar a
 * `@rentar/ui` (cambio que necesita el OK del PO).
 * NOTA: sin "Escribir por WhatsApp": ninguna fuente tiene el teléfono del
 * dueño (y no se muestra hasta que acepta la solicitud). Tampoco "Publica
 * desde…" ni "N propiedades publicadas": no hay datos para eso.
 */
import type { ReactNode } from 'react'
import { Avatar, Button, Card, Tooltip } from 'antd'
import { MailOutlined } from '@ant-design/icons'
import type { DuenoPropiedad } from '@rentar/shared-types'
import { iniciales } from '@/lib/utils/iniciales'
import styles from './OwnerCard.module.css'

/** Props de {@link OwnerCard}. */
interface OwnerCardProps {
  /** `null` o sin nombre: se muestra "El dueño", sin inventar uno. */
  owner: DuenoPropiedad | null
  /** La acción principal (`AccionSolicitar`). */
  action: ReactNode
  /** Secciones extra debajo de las acciones (condiciones, medios de pago). */
  children?: ReactNode
  'data-testid'?: string
}

/** Mensaje del tooltip de "Enviar mensaje": Mensajes no es de este sprint. */
const MENSAJES_PROXIMAMENTE = 'Los mensajes llegan en un próximo sprint'

/**
 * Tarjeta del dueño con la acción principal del detalle. El nombre se
 * muestra solo si se conoce (dueños del elenco o, cuando el back lo mande, el
 * de la API).
 */
export function OwnerCard({ owner, action, children, ...rest }: OwnerCardProps) {
  const nombre = owner?.fullName ?? null

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <Card className={styles.card} {...rest}>
      <div className={styles.header}>
        <Avatar size={48} className={styles.avatar} aria-hidden="true">
          {nombre ? iniciales(nombre) : '?'}
        </Avatar>
        <div className={styles.identity}>
          <span className={styles.name} data-testid="detalle-propiedad-dueno">
            {nombre ?? 'El dueño'}
          </span>
          <span className={styles.role}>Dueño · publica sin inmobiliaria</span>
        </div>
      </div>

      <div className={styles.actions}>
        {action}
        {/* Mensajes es de otro sprint: deshabilitado con explicación, en vez de un link roto. */}
        <Tooltip title={MENSAJES_PROXIMAMENTE}>
          <Button size="large" block disabled icon={<MailOutlined />} className={styles.secondary} data-testid="detalle-propiedad-enviar-mensaje-button">
            Enviar mensaje
          </Button>
        </Tooltip>
      </div>

      {children && <div className={styles.sections}>{children}</div>}
    </Card>
  )
}
