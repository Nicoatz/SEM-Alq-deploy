/**
 * /firma-garante/[token] — página pública donde el garante firma el contrato (US-07).
 *
 * Qué es: el garante abre el enlace que le pasó el locador, ve su nombre, el
 * código del contrato y la propiedad, acepta y firma en DocuSign. Sin sesión,
 * sin `RequireRole` y sin "Rechazar". La pantalla vive en
 * `components/firma-garante/FirmaGarante.tsx`.
 * NOTA (seguridad): el token va en la URL. Por eso la página sale con
 * `Referrer-Policy: no-referrer` (acá en la metadata y como header en
 * `next.config.mjs`), no se indexa, y el título no tiene datos del garante.
 * Entra desde: el enlace que genera el locador en el detalle del contrato, y la
 * vuelta de DocuSign (`?event=…`).
 */
import type { Metadata } from 'next'
import { FirmaGarante } from '@/components/firma-garante/FirmaGarante'

/** Título genérico (el layout raíz le suma "— RentAR"), sin indexar y sin `Referer`. */
export const metadata: Metadata = {
  title: 'Firma del contrato',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

/** Monta la pantalla del garante con el token de la URL. */
export default async function FirmaGarantePage({ params }: PageProps<'/firma-garante/[token]'>) {
  const { token } = await params
  return <FirmaGarante key={token} token={token} />
}
