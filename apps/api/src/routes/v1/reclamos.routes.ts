import { Router } from 'express';

import { reclamoController } from '../../controllers/reclamo.controller';
import { authenticateGateway, requireRole } from '../../gateway/middlewares/auth.middleware';

const router = Router();

// Requerir autenticación para todas las operaciones de reclamos
router.use(authenticateGateway);

/**
 * @openapi
 * /api/v1/reclamos/tipos:
 *   get:
 *     summary: Catálogo de tipos de reclamo (US-14)
 *     description: Devuelve los tipos de reclamos disponibles (pintura, reparación del inmueble, reparación de artefactos, cobros, otro).
 *     tags:
 *       - Reclamos
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de tipos de reclamos.
 */
router.get('/tipos', reclamoController.obtenerTiposReclamo.bind(reclamoController));

/**
 * @openapi
 * /api/v1/reclamos:
 *   post:
 *     summary: Registrar un reclamo (US-14)
 *     description: Permite al locatario registrar un reclamo sobre una propiedad con contrato de alquiler vigente.
 *     tags:
 *       - Reclamos
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id_inmueble
 *               - mensaje
 *             properties:
 *               id_inmueble:
 *                 type: integer
 *               id_tipo_reclamo:
 *                 type: integer
 *               tipo_reclamo:
 *                 type: string
 *                 enum: [pintura, reparacion_inmueble, reparacion_artefactos, cobros, otro]
 *               titulo:
 *                 type: string
 *               mensaje:
 *                 type: string
 *                 minLength: 50
 *                 maxLength: 5000
 *               fotos:
 *                 type: array
 *                 maxItems: 10
 *                 items:
 *                   type: object
 *                   required:
 *                     - url
 *                     - peso_kb
 *                     - formato
 *                   properties:
 *                     url:
 *                       type: string
 *                     peso_kb:
 *                       type: integer
 *                       maximum: 350
 *                     formato:
 *                       type: string
 *                       enum: [jpg, jpeg, png, image/jpeg, image/png]
 *                     orden:
 *                       type: integer
 *     responses:
 *       201:
 *         description: Reclamo registrado exitosamente.
 *       400:
 *         description: Datos inválidos, mensaje fuera de longitud o imágenes que no cumplen las restricciones.
 *       403:
 *         description: No posee un contrato de alquiler vigente para la propiedad seleccionada o no es locatario.
 */
router.post(
  '/',
  requireRole('locatario'),
  reclamoController.registrarReclamo.bind(reclamoController)
);

export default router;
