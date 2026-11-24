/**
 * GrupoReclamos.tsx — los reclamos de una propiedad del locador, bajo un
 * encabezado con la propiedad y su locatario.
 *
 * Qué muestra (Claude Design, "Reclamos" · 02): imagen principal, dirección,
 * barrio, y a la derecha el locatario (iniciales, nombre y "Locatario"); abajo,
 * una fila por reclamo.
 * NOTA: el diseño suma "contrato vigente CT-2026-0148" debajo de la dirección;
 * el reclamo no trae el código del contrato (el back manda `id_contrato`, sin
 * código), así que no va.
 * Cubre US-15 ("si se es locador se debe mostrar la foto de perfil y nombre del locatario").
 *
 * Quién lo usa: `Reclamos` (vista del locador).
 */
import type { GrupoReclamos as Grupo } from '@/lib/reclamos/filtros'
import { AvatarPersona } from '@/components/personas/AvatarPersona'
import { FilaReclamo } from './FilaReclamo'
import { FotoPropiedadReclamo } from './FotoPropiedadReclamo'
import styles from './Reclamos.module.css'

/** Props de {@link GrupoReclamos}. */
interface GrupoReclamosProps {
  grupo: Grupo
}

/** Una propiedad con sus reclamos. */
export function GrupoReclamos({ grupo }: GrupoReclamosProps) {
  return (
    <section className={styles.grupo} aria-label={`Reclamos de ${grupo.propiedad.direccion}`} data-testid="reclamos-grupo">
      <header className={styles.grupoHeader}>
        <FotoPropiedadReclamo src={grupo.propiedad.fotoSrc} />
        <span className={styles.grupoTitulo}>
          <span className={styles.direccion}>{grupo.propiedad.direccion}</span>
          {grupo.propiedad.barrio && <span className={styles.grupoSub}>{grupo.propiedad.barrio}</span>}
        </span>
        <span className={styles.grupoPersona}>
          <AvatarPersona nombre={grupo.locatario.nombre} fotoSrc={grupo.locatario.fotoSrc} rol="Locatario" data-testid="reclamos-grupo-locatario" />
        </span>
      </header>
      {grupo.reclamos.map((reclamo) => (
        <FilaReclamo key={reclamo.id} reclamo={reclamo} vista="locador" />
      ))}
    </section>
  )
}
