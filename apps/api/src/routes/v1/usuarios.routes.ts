import { Router } from 'express';
import { usuarioController } from '../../controllers/usuario.controller';
import { authenticateGateway } from '../../gateway/middlewares/auth.middleware';

const router = Router();


/**
 * @openapi
 * /api/v1/usuarios/me:
 *   get:
 *     summary: Obtener el perfil del usuario autenticado
 *     description: >
 *       Devuelve los datos personales del usuario autenticado y sus roles.
 *       Requiere un token Bearer válido. El perfil se identifica a partir
 *       de la sesión autenticada, por lo que no es necesario enviar un ID.
 *       La contraseña nunca se devuelve.
 *     tags:
 *       - Usuarios
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Perfil del usuario obtenido exitosamente.
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
 *                   example: Datos del usuario obtenidos exitosamente.
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     nombre:
 *                       type: string
 *                       example: Carlos
 *                     apellido:
 *                       type: string
 *                       example: Propietario
 *                     email:
 *                       type: string
 *                       format: email
 *                       example: locador@rentar.com
 *                     numero_documento:
 *                       type: string
 *                       example: "30111222"
 *                     telefono:
 *                       type: string
 *                       nullable: true
 *                       example: "3511112233"
 *                     fecha_nacimiento:
 *                       type: string
 *                       format: date
 *                       nullable: true
 *                       example: null
 *                     roles:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example:
 *                         - locatario
 *                         - locador
 *       401:
 *         description: No autorizado. El token falta o no es válido.
 *       404:
 *         description: No se encontró el perfil del usuario autenticado.
 *       500:
 *         description: Error interno del servidor.
 */

router.get(
  '/me',
  authenticateGateway,
  usuarioController.obtenerMiPerfil.bind(usuarioController)
);

export default router;