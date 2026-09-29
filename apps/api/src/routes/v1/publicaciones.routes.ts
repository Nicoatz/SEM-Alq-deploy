import { Router, Request, Response, NextFunction } from 'express';
import { publicacionService } from '../../services/publicacion.service';
import { authenticateGateway, requireRole } from '../../gateway/middlewares/auth.middleware';
import { publicacionController } from '../../controllers/publicacion.controller';

const router = Router();

/**
 * @openapi
 * /api/v1/publicaciones:
 *   post:
 *     summary: Crear una publicación para un inmueble
 *     description: Requiere que el inmueble ya cuente con un contrato asociado (regla de negocio).
 *     tags:
 *       - Publicaciones
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id_inmueble
 *               - titulo
 *               - precio
 *             properties:
 *               id_inmueble:
 *                 type: integer
 *               titulo:
 *                 type: string
 *               precio:
 *                 type: number
 *     responses:
 *       201:
 *         description: Publicación creada exitosamente
 *       400:
 *         description: Error al publicar (ej. no cuenta con contrato asociado)
 */
router.post(
  '/',
  authenticateGateway,
  requireRole('locador'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const nuevaPub = await publicacionService.crearPublicacion(req.body);
      res.status(201).json({
        success: true,
        message: 'Publicación creada exitosamente.',
        data: nuevaPub
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /api/v1/publicaciones/activas:
 *   get:
 *     summary: Consultar publicaciones activas
 *     description: Obtiene todas las publicaciones activas junto con los datos del inmueble asociado.
 *     tags:
 *       - Publicaciones
 *     responses:
 *       200:
 *         description: Publicaciones activas obtenidas exitosamente.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       id_inmueble:
 *                         type: integer
 *                         example: 1
 *                       titulo:
 *                         type: string
 *                         example: Alquiler Departamento 2 Dormitorios - Centro / Alberdi
 *                       precio:
 *                         type: number
 *                         example: 350000
 *                       activa:
 *                         type: boolean
 *                         example: true
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                         example: 2026-09-02T10:00:00.000Z
 *                       inmueble:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                             example: 1
 *                           tipo:
 *                             type: integer
 *                             example: 1
 *                           direccion:
 *                             type: string
 *                             example: Av. Colón
 *                           numero:
 *                             type: integer
 *                             example: 1550
 *                           piso:
 *                             type: string
 *                             nullable: true
 *                             example: 4B
 *                           ciudad:
 *                             type: string
 *                             example: Córdoba
 *                           ambientes:
 *                             type: integer
 *                             example: 3
 *                           dormitorios:
 *                             type: integer
 *                             example: 2
 *                           banos:
 *                             type: integer
 *                             example: 1
 *                           m2:
 *                             type: integer
 *                             example: 65
 *                           descripcion:
 *                             type: string
 *                             nullable: true
 *                             example: Hermoso departamento luminoso con balcón y excelentes accesos
 *                           tags:
 *                             type: integer
 *                             nullable: true
 *                             example: 1
 *                           servicios:
 *                             type: integer
 *                             nullable: true
 *                             example: 4
 *       500:
 *         description: Error interno del servidor.
 */
router.get(
  '/activas',
  publicacionController.obtenerPublicacionesActivas.bind(
    publicacionController
  )
);

export default router;
