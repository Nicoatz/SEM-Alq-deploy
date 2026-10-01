/**
 * / — landing pública (arquetipo A1). Diseño: dirección "A · La consola"
 * (la landing no tiene vista de Claude Design, ver `docs/MapaDePantallas.pdf`).
 *
 * Qué es: el buscador como hero (entra completo en el primer viewport y
 * funciona sin JS), los diferenciales, las publicaciones más recientes y
 * "Cómo funciona".
 * Cubre: US-34 Consultar propiedades a alquilar (entrada a `/buscar`).
 *
 * De dónde saca los datos: `services/propiedades.service.ts#listarPropiedadesRecientes`,
 * llamado del lado del servidor dentro de `RecientesSection` (con `Suspense`).
 *
 * NOTA: la página no espera al back. El hero y los diferenciales salen en el
 * primer envío del HTML (el titular es el LCP) y las tarjetas llegan después
 * por streaming. Antes la landing entera esperaba a `/inmuebles/disponibles`.
 * NOTA: del lado del servidor no hay `localStorage`, así que en modo mock la
 * landing muestra solo el elenco (no las propiedades creadas en el alta).
 * `/buscar` sí las muestra, porque carga del lado del cliente.
 */
import HowItWorks from '@/components/HowItWorks'
import { Diferenciales } from '@/components/landing/Diferenciales'
import { LandingHero } from '@/components/landing/LandingHero'
import { RecientesSection } from '@/components/landing/RecientesSection'

/** La landing (`/`). El layout de `app/(public)/` pone el Header y el Footer. */
export default function LandingPage() {
  return (
    <>
      <LandingHero />
      <Diferenciales />
      <RecientesSection />
      {/* Provisorio: el "Cómo funciona" nuevo (motivo + timeline sincronizados) llega en el próximo paso. */}
      <HowItWorks />
    </>
  )
}
