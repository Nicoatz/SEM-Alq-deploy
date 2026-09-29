import { Router } from 'express';
import { misAlquileresController } from '../../controllers/mis-alquileres.controller';
import { authenticateGateway, requireRole } from '../../gateway/middlewares/auth.middleware';

const router = Router();

/**
 * @openapi
 * /api/v1/locadores/{idLocador}/barrios:
 *   get:
 *     summary: Obtener los barrios del locador
 *     description: Devuelve los barrios únicos donde el locador tiene propiedades registradas.
 *     tags:
 *       - Locadores
 *     security:
 *       - SupabaseBearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idLocador
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del locador autenticado.
 *     responses:
 *       200:
 *         description: Barrios obtenidos exitosamente.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: string
 *       401:
 *         description: No autenticado.
 *       403:
 *         description: El ID no corresponde al locador autenticado o no posee el rol requerido.
 */
router.get(
  '/:idLocador/barrios',
  authenticateGateway,
  requireRole('locador'),
  misAlquileresController.getBarrios.bind(misAlquileresController)
);

export default router;