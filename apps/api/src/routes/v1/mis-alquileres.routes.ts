import { Router } from 'express';
import { misAlquileresController } from '../../controllers/mis-alquileres.controller';
import { authenticateGateway, requireRole } from '../../gateway/middlewares/auth.middleware';

const router = Router();

/**
 * @openapi
 * /api/v1/mis-alquileres:
 *   get:
 *     summary: Consultar las propiedades del locador autenticado
 *     description: Retorna las propiedades del locador, con filtros opcionales por barrio, tipo y estado de alquiler.
 *     tags:
 *       - Mis Alquileres
 *     parameters:
 *       - in: query
 *         name: barrio
 *         schema:
 *           type: string
 *         description: Filtra por barrio.
 *       - in: query
 *         name: tipo
 *         schema:
 *           type: integer
 *         description: Filtra por ID del tipo de inmueble.
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *           enum: [publicado, pausado, alquilado, publicado/alquilado]
 *         description: Filtra por estado de alquiler.
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
 *                     properties:
 *                       id_inmueble:
 *                         type: integer
 *                       titulo_direccion:
 *                         type: string
 *                       estado_alquiler:
 *                         type: string
 *                       posee_reclamos_no_resueltos:
 *                         type: boolean
 *                       contrato:
 *                         type: object
 *                         properties:
 *                           locatario:
 *                             nullable: true
 *                             type: object
 *                           fecha_proximo_ajuste:
 *                             nullable: true
 *                             type: string
 *                             format: date
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
