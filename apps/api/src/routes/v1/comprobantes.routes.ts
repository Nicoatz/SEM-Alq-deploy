import { Router } from 'express';
import { comprobantePagoController } from '../../controllers/comprobante-pago.controller';
import { authenticateGateway } from '../../gateway/middlewares/auth.middleware';

const router = Router();

/**
 * @openapi
 * /api/v1/cobros/{id}/comprobante:
 *   get:
 *     summary: Consultar un comprobante de pago
 *     description: Devuelve el comprobante si el usuario es el locador propietario o el locatario principal del contrato.
 *     tags: [Cobros]
 *     security:
 *       - SupabaseBearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       200:
 *         description: Datos del comprobante de pago.
 *       401:
 *         description: No autorizado.
 *       404:
 *         description: El comprobante no existe o no pertenece al usuario.
 *       500:
 *         description: No se pudo construir el comprobante.
 * /api/v1/cobros/{id}/comprobante/pdf:
 *   get:
 *     summary: Descargar o visualizar un comprobante de pago en PDF
 *     tags: [Cobros]
 *     security:
 *       - SupabaseBearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: descarga
 *         schema: { type: boolean, default: true }
 *         description: false devuelve disposición inline para visualizar o imprimir.
 *     responses:
 *       200:
 *         description: PDF generado en memoria.
 *         content:
 *           application/pdf:
 *             schema: { type: string, format: binary }
 *       401:
 *         description: No autorizado.
 *       404:
 *         description: El comprobante no existe o no pertenece al usuario.
 *       500:
 *         description: No se pudo generar el PDF.
 */
router.get(
  '/:id/comprobante',
  authenticateGateway,
  comprobantePagoController.obtener.bind(comprobantePagoController)
);

router.get(
  '/:id/comprobante/pdf',
  authenticateGateway,
  comprobantePagoController.pdf.bind(comprobantePagoController)
);

export default router;
