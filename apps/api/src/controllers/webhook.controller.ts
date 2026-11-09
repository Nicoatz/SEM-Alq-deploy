import { NextFunction, Request, Response } from 'express';

import { leerConfigDocusign } from '../config/docusign';
import { firmaDocusignValida } from '../services/docusign-hmac';
import { docusignWebhookService } from '../services/docusign-webhook.service';

/** Lo poco que usamos del aviso de DocuSign Connect (el resto se guarda tal cual para auditoría). */
interface AvisoCrudo {
  event?: string;
  generatedDateTime?: string;
  envelopeId?: string;
  data?: { envelopeId?: string; recipientId?: string };
}

/**
 * Webhook de DocuSign Connect (US-07, Paso 5). Público: lo autentica la firma HMAC del aviso, no un
 * token de usuario. Responde 200 solo si el aviso se procesó; ante cualquier fallo responde un
 * error y DocuSign lo reintenta.
 */
export class WebhookController {
  /** POST /webhooks/docusign */
  async docusign(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { connectHmacKey } = leerConfigDocusign();

      // Sin clave no se puede comprobar de dónde viene el aviso: no se acepta.
      if (!connectHmacKey) {
        console.error('[webhook] Falta DOCUSIGN_CONNECT_HMAC_KEY: no se pueden verificar los avisos de DocuSign.');
        res.status(500).json({ success: false, error: 'Webhook sin configurar.' });
        return;
      }

      const cuerpoCrudo = (req as Request & { rawBody?: Buffer }).rawBody;

      if (!cuerpoCrudo || !firmaDocusignValida(cuerpoCrudo, nombre => req.header(nombre), connectHmacKey)) {
        res.status(401).json({ success: false, error: 'Firma inválida.' });
        return;
      }

      const aviso = req.body as AvisoCrudo;
      const envelopeId = aviso?.data?.envelopeId ?? aviso?.envelopeId;

      // Sin sobre no hay nada que sincronizar. Se responde 200 para que DocuSign no reintente en vano.
      if (!envelopeId) {
        console.warn('[webhook] Aviso de DocuSign sin id de sobre; se ignora.');
        res.status(200).json({ success: true, message: 'Aviso ignorado.' });
        return;
      }

      const tipo = aviso.event ?? 'desconocido';
      const resultado = await docusignWebhookService.procesar({
        envelopeId,
        tipo,
        clave: [envelopeId, tipo, aviso.data?.recipientId ?? '', aviso.generatedDateTime ?? ''].join('|'),
        payload: aviso,
      });

      console.log(`[webhook] ${tipo} ${envelopeId}: ${resultado.accion}`);
      res.status(200).json({ success: true, message: 'Aviso procesado.' });
    } catch (error) {
      next(error);
    }
  }
}

export const webhookController = new WebhookController();
