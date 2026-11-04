import { Router } from 'express';
import { cobroConsultaController } from '../../controllers/cobro-consulta.controller';
import { authenticateGateway } from '../../gateway/middlewares/auth.middleware';

const router = Router();

/**
 * @openapi
 * /api/v1/cobros-locatario:
 *   get:
 *     summary: Consultar pagos del locatario autenticado
 *     description: Solo incluye contratos donde el usuario participa como locatario principal. El resumen anual usa la fecha efectiva del cobro; el filtro anio agrupa por período.
 *     tags: [Cobros]
 *     security:
 *       - SupabaseBearerAuth: []
 *     parameters:
 *       - in: query
 *         name: anio
 *         schema: { type: integer, minimum: 2000 }
 *         description: Año del período para el listado; los indicadores anuales se agrupan por fecha de cobro.
 *       - in: query
 *         name: estado
 *         schema: { type: string, enum: [todos, pendiente, vencido, pagado] }
 *       - in: query
 *         name: medio
 *         schema: { type: string, enum: [transferencia, efectivo, cheque, mercadopago_externo, otro] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100 }
 *     responses:
 *       200:
 *         description: Próximo período, historial de pagos e indicadores anuales.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/PagosLocatario' }
 *       400:
 *         description: Filtros inválidos.
 *       401:
 *         description: No autenticado.
 */
router.get('/', authenticateGateway, cobroConsultaController.pagosLocatario.bind(cobroConsultaController));

export default router;