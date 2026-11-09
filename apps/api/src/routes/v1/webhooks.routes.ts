import { Router } from 'express';

import { webhookController } from '../../controllers/webhook.controller';

const router = Router();

/**
 * @openapi
 * /api/v1/webhooks/docusign:
 *   post:
 *     summary: Aviso de DocuSign Connect (US-07)
 *     description: >
 *       **Lo llama DocuSign, no el front.** Sin sesión: se autentica con la firma HMAC-SHA256 del
 *       cuerpo (cabeceras `X-DocuSign-Signature-N`), verificada con `DOCUSIGN_CONNECT_HMAC_KEY`.
 *       El aviso es solo un disparador: la API le pregunta a DocuSign el estado real del sobre y
 *       registra las firmas (fecha, hora e IP), el rechazo o el paso a vigente. Es idempotente:
 *       DocuSign reintenta hasta recibir un 200. Cuando todas las partes firman, en una
 *       transacción: el contrato pasa a vigente, la propiedad a alquilada y las solicitudes
 *       pendientes a rechazadas.
 *     tags:
 *       - Firma de contratos
 *     responses:
 *       200:
 *         description: Aviso procesado o ignorado (sobre desconocido, repetido o sin cambios).
 *       401:
 *         description: La firma HMAC no coincide.
 *       500:
 *         description: Falló el procesamiento o falta configuración; DocuSign reintenta.
 */
router.post('/docusign', webhookController.docusign.bind(webhookController));

export default router;
