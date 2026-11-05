import { Router } from 'express';
import multer from 'multer';
import { cobroController } from '../../controllers/cobro.controller';
import { cobroConsultaController } from '../../controllers/cobro-consulta.controller';
import { authenticateGateway, requireRole } from '../../gateway/middlewares/auth.middleware';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.mimetype)) {
      callback(new Error('El comprobante debe ser PDF, JPG o PNG.'));
      return;
    }
    callback(null, true);
  },
});

/**
 * @openapi
 * /api/v1/cobros-locador/historial:
 *   get:
 *     summary: Consultar el historial de períodos del locador
 *     description: Lista períodos de contratos vinculados a propiedades propias. Los agregados se calculan antes de paginar.
 *     tags: [Cobros]
 *     security:
 *       - SupabaseBearerAuth: []
 *     parameters:
 *       - in: query
 *         name: estado
 *         schema: { type: string, enum: [todos, pendiente, vencido, pagado] }
 *       - in: query
 *         name: id_inmueble
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: periodo
 *         schema: { type: string, pattern: '^\\d{4}-(0[1-9]|1[0-2])$' }
 *       - in: query
 *         name: desde
 *         schema: { type: string, pattern: '^\\d{4}-(0[1-9]|1[0-2])$' }
 *       - in: query
 *         name: hasta
 *         schema: { type: string, pattern: '^\\d{4}-(0[1-9]|1[0-2])$' }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100 }
 *     responses:
 *       200:
 *         description: Historial con indicadores calculados sobre todo el conjunto filtrado.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/HistorialCobrosLocador' }
 *       400:
 *         description: Filtros inválidos.
 *       401:
 *         description: No autenticado.
 *       403:
 *         description: Se requiere el rol locador.
 */
router.get(
  '/historial',
  authenticateGateway,
  requireRole('locador'),
  cobroConsultaController.historialLocador.bind(cobroConsultaController)
);

/**
 * @openapi
 * /api/v1/cobros-locador:
 *   get:
 *     summary: Consultar períodos cobrables del locador
 *     tags: [Cobros]
 *     security:
 *       - SupabaseBearerAuth: []
 *     parameters:
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *           enum: [pendiente, vencido]
 *       - in: query
 *         name: id_inmueble
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: id_contrato
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: desde
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: hasta
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Períodos pendientes o vencidos del locador.
 *       401:
 *         description: No autorizado.
 *       403:
 *         description: Se requiere el rol locador.
 *       500:
 *         description: Error interno.
 *   post:
 *     summary: Registrar un cobro manual por el saldo total del período
 *     tags: [Cobros]
 *     security:
 *       - SupabaseBearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [id_periodo, fecha_cobro, medio]
 *             properties:
 *               id_periodo: { type: integer, minimum: 1 }
 *               fecha_cobro: { type: string, format: date }
 *               medio:
 *                 type: string
 *                 enum: [transferencia, efectivo, cheque, mercadopago_externo, otro]
 *               nota: { type: string, maxLength: 200 }
 *               comprobante:
 *                 type: string
 *                 format: binary
 *                 description: PDF, JPG o PNG de hasta 5 MB.
 *     responses:
 *       201:
 *         description: Cobro registrado y período pagado.
 *       400:
 *         description: Datos inválidos o comprobante no admitido.
 *       403:
 *         description: La propiedad no pertenece al locador.
 *       409:
 *         description: Período no cobrable o contrato no vigente.
 */
router.get(
  '/',
  authenticateGateway,
  requireRole('locador'),
  cobroController.listar.bind(cobroController)
);

router.post(
  '/',
  authenticateGateway,
  requireRole('locador'),
  upload.single('comprobante'),
  cobroController.registrar.bind(cobroController)
);

export default router;
