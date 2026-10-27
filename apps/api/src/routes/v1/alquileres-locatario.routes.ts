import { Router } from 'express';
import { alquilerLocatarioController } from '../../controllers/alquiler-locatario.controller';
import { authenticateGateway } from '../../gateway/middlewares/auth.middleware';

const router = Router();

/**
 * @openapi
 * /api/v1/alquileres-locatario:
 *   get:
 *     summary: Consultar los alquileres del locatario autenticado
 *     description: Lista únicamente contratos donde el usuario autenticado participa como locatario principal.
 *     tags:
 *       - Alquileres del locatario
 *     security:
 *       - SupabaseBearerAuth: []
 *     parameters:
 *       - in: query
 *         name: estado
 *         required: false
 *         schema:
 *           type: string
 *           enum: [pendiente_firma, vigente, finalizado]
 *         description: Filtra por estado. Sin filtro devuelve los estados en el orden definido por US-27.
 *     responses:
 *       200:
 *         description: Listado de alquileres del locatario.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [success, data]
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AlquilerLocatarioItem'
 *       400:
 *         description: Filtro de estado inválido.
 *       401:
 *         description: No autenticado.
 */
router.get('/', authenticateGateway, alquilerLocatarioController.listar.bind(alquilerLocatarioController));

/**
 * @openapi
 * /api/v1/alquileres-locatario/{idContrato}:
 *   get:
 *     summary: Consultar la ficha de un alquiler propio
 *     description: Devuelve el detalle solo si el usuario autenticado es locatario del contrato. Contratos ajenos e inexistentes responden igual.
 *     tags:
 *       - Alquileres del locatario
 *     security:
 *       - SupabaseBearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idContrato
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       200:
 *         description: Detalle del alquiler propio.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [success, data]
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/AlquilerLocatarioDetalle'
 *       400:
 *         description: ID de contrato inválido.
 *       401:
 *         description: No autenticado.
 *       404:
 *         description: No encontramos este alquiler.
 */
router.get('/:idContrato', authenticateGateway, alquilerLocatarioController.obtenerDetalle.bind(alquilerLocatarioController));

export default router;