import { Router } from 'express';
import { misAlquileresController } from '../../controllers/mis-alquileres.controller';
import { authenticateGateway, requireRole } from '../../gateway/middlewares/auth.middleware';

const router = Router();

/**
 * @openapi
 * /api/v1/mis-alquileres:
 *   get:
 *     summary: Obtener todas las propiedades publicadas del locador autenticado
 *     description: Retorna el inventario de inmuebles publicados por el locador, tanto las disponibles para alquiler como aquellas con contrato ya pactado con un locatario.
 *     tags:
 *       - Mis Alquileres
 *     security:
 *       - SupabaseBearerAuth: []
 *     responses:
 *       200:
 *         description: Listado obtenido exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: No autenticado
 *       403:
 *         description: Acceso denegado (no es locador)
 */
router.get(
  '/',
  authenticateGateway,
  requireRole('locador'),
  misAlquileresController.getMisAlquileres.bind(misAlquileresController)
);

export default router;
