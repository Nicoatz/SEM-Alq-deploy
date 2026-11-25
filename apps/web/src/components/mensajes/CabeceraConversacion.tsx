/**
 * CabeceraConversacion.tsx — arriba de una conversación: la propiedad y la otra persona.
 *
 * Qué muestra (Claude Design, "Mensajes" · 01 y 05): la foto y la dirección de la
 * propiedad, "Con Sofía Ledesma · locataria" y "Ver propiedad"; en móvil, la
 * flecha para volver a la bandeja.
 * NOTA: en real la conversación trae la dirección sin foto (brecha R-6): va el
 * placeholder. Sin dirección, la línea queda vacía.
 *
 * Quién lo usa: `PanelConversacion` y `PanelNuevaConversacion`.
 */
import Link from 'next/link'
import { Button } from 'antd'
import { LeftOutlined } from '@ant-design/icons'
import type { PersonaConversacion, PropiedadConversacion } from '@/lib/mensajes/tipos'
import { FotoPropiedadReclamo } from '@/components/reclamos/FotoPropiedadReclamo'
import styles from './Mensajes.module.css'

/** Props de {@link CabeceraConversacion}. */
interface CabeceraConversacionProps {
  persona: Pick<PersonaConversacion, 'nombre' | 'rol'>
  propiedad: Pick<PropiedadConversacion, 'id' | 'direccion' | 'fotoSrc'> | null
}

/** Encabezado de la conversación abierta. */
export function CabeceraConversacion({ persona, propiedad }: CabeceraConversacionProps) {
  // Si la otra persona es la locataria, la propiedad es del usuario: va a su ficha del panel.
  const hrefPropiedad = propiedad ? (persona.rol === 'locatario' ? `/panel/propiedades/${encodeURIComponent(propiedad.id)}` : `/propiedad/${encodeURIComponent(propiedad.id)}`) : null
  return (
    <header className={styles.cabecera} data-testid="mensajes-cabecera">
      <Link href="/panel/mensajes" className={styles.volver} aria-label="Volver a la bandeja" data-testid="mensajes-volver">
        <LeftOutlined />
      </Link>
      {propiedad && <FotoPropiedadReclamo src={propiedad.fotoSrc} tamanio="sm" />}
      <span className={styles.cabeceraTextos}>
        <span className={styles.cabeceraTitulo}>{propiedad?.direccion ?? persona.nombre}</span>
        <span className={styles.cabeceraSub}>
          Con <strong>{persona.nombre}</strong> · {persona.rol}
        </span>
      </span>
      {hrefPropiedad && (
        <Link href={hrefPropiedad} className={styles.cabeceraAccion} data-testid="mensajes-ver-propiedad">
          <Button size="small">Ver propiedad</Button>
        </Link>
      )}
    </header>
  )
}
