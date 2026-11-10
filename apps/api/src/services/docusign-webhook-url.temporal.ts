/**
 * TEMPORAL(webhook-url) · URL del webhook a partir del dominio por el que llegó el pedido.
 *
 * Qué es: un parche para probar la firma en `develop` sin tocar las variables de entorno de Vercel.
 * `DOCUSIGN_WEBHOOK_URL` apuntaba al dominio de producción, donde todavía no está este código, y DocuSign
 * recibía un 404. Con esto, el sobre queda con el webhook del mismo dominio al que llamó el cliente.
 *
 * Qué cubre: US-07 (aviso de las firmas). Lo usa `ContratoController#enviar`.
 *
 * CÓMO SACARLO (cuando la variable esté bien cargada en Vercel):
 *   1. Borrar este archivo.
 *   2. En `contrato.controller.ts`: quitar el import y el argumento extra de `contratoService.enviar`.
 *   3. En `contrato.service.ts`: quitar el parámetro `webhookUrl` de `enviar` y su paso a `crearSobre`.
 *   4. En `docusign.client.ts`: quitar `webhookUrl` de `CrearSobreInput` y volver a leerlo solo de la config.
 *   Todo está marcado con `TEMPORAL(webhook-url)`: buscarlo con grep.
 */
import type { Request } from 'express';

const RUTA_WEBHOOK = '/api/v1/webhooks/docusign';

/**
 * Devuelve la URL del webhook para el dominio del pedido, o `null` si no corresponde usarla.
 *
 * Seguridad: el encabezado `Host` lo manda el cliente. Para que un usuario no pueda apuntar el aviso
 * (que lleva datos del contrato) a un servidor propio, solo se acepta un dominio `*.vercel.app` con
 * HTTPS. Cualquier otro caso (por ejemplo, local) usa `DOCUSIGN_WEBHOOK_URL`.
 */
export function webhookUrlDesdePedido(req: Pick<Request, 'get'>): string | null {
  const host = (req.get('x-forwarded-host') ?? req.get('host') ?? '').split(',')[0].trim().toLowerCase();

  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)*\.vercel\.app$/.test(host)) {
    return null;
  }

  return `https://${host}${RUTA_WEBHOOK}`;
}
