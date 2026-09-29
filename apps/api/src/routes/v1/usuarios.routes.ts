import { Router } from 'express';
import { usuarioController } from '../../controllers/usuario.controller';
import { authenticateGateway } from '../../gateway/middlewares/auth.middleware';

const router = Router();

/**
 * @openapi
 * /api/v1/usuarios/me:
 *   get:
 *     summary: Obtener los datos del usuario autenticado
 *     tags:
 *       - Usuarios
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Datos del usuario autenticado
 *       401:
 *         description: No autorizado
 */
router.get(
  '/me',
  authenticateGateway,
  usuarioController.obtenerMiPerfil.bind(usuarioController)
);

export default router;