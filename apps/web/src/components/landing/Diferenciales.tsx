/**
 * Diferenciales.tsx — franja de la landing con los tres diferenciales de
 * RentAR, justo debajo del hero.
 *
 * Qué es: por qué alquilar con RentAR, en tres frases. A propósito no son
 * tarjetas con ícono + título + texto (patrón rechazado en `docs/DESIGN.md`):
 * es una franja tipográfica con hairlines.
 * Cubre: sin US en Sprint 0 (contenido de la landing).
 * De dónde saca los datos: textos fijos, aprobados por el PO (01/10/2026).
 * NOTA: se describen en presente como el servicio que es RentAR (firma a
 * distancia, ajuste y pagos son de sprints siguientes), sin ningún link a
 * flujos que todavía no existen (decisión del PO, 01/10/2026). "Sin comisión
 * inmobiliaria para el locatario" está confirmado por el PO.
 * Quién lo usa: `app/(public)/page.tsx`.
 */
import styles from './Diferenciales.module.css'

interface Diferencial {
  titulo: string
  texto: string
}

const DIFERENCIALES: Diferencial[] = [
  { titulo: 'Sin comisión inmobiliaria', texto: 'para quien alquila.' },
  { titulo: 'Contrato y firma a distancia', texto: 'también para tu garante.' },
  { titulo: 'Ajuste por IPC o ICL', texto: 'y cada pago con su registro.' },
]

/** Franja de diferenciales (el título de la sección es solo para lectores de pantalla). */
export function Diferenciales() {
  return (
    <section className={styles.section} aria-labelledby="landing-diferenciales-titulo">
      <h2 id="landing-diferenciales-titulo" className={styles.srOnly}>
        Por qué alquilar con RentAR
      </h2>
      <ul className={styles.list}>
        {DIFERENCIALES.map((diferencial) => (
          <li key={diferencial.titulo} className={styles.item} data-reveal>
            <p className={styles.itemTitle}>{diferencial.titulo}</p>
            <p className={styles.itemText}>{diferencial.texto}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
