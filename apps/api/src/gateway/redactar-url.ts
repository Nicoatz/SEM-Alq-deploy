/**
 * Oculta los secretos de una URL antes de escribirla en un log.
 *
 * El enlace de firma de un garante lleva su token en la ruta (`/firma-garante/<token>`): es su
 * única credencial, así que no puede quedar en los logs de la plataforma, donde lo vería cualquiera
 * con acceso a ellos y podría firmar en su nombre mientras el enlace esté vigente.
 */
export function redactarUrl(url: string): string {
  return url.replace(/(\/firma-garante\/)[^/?#]+/, '$1[token]');
}
