import { Router } from 'express';
import { usuarioController } from '../../controllers/usuario.controller';

const router = Router();

/**
 * @openapi
 * /api/v1/registrar-usuario:
 *   post:
 *     summary: Registrar un usuario como locatario
 *     tags:
 *       - Usuarios
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nombre
 *               - apellido
 *               - email
 *               - contraseña
 *               - confirmar_contraseña
 *               - telefono
 *               - numero_documento
 *               - fecha_nacimiento
 *               - acepta_terminos
 *             properties:
 *               nombre:
 *                 type: string
 *               apellido:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               contraseña:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *               confirmar_contraseña:
 *                 type: string
 *                 format: password
 *               telefono:
 *                 type: string
 *               numero_documento:
 *                 type: string
 *               fecha_nacimiento:
 *                 type: string
 *                 format: date
 *               acepta_terminos:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Usuario registrado
 *       400:
 *         description: Datos inválidos
 *       409:
 *         description: Email o documento ya registrado
 */
router.post(
  '/',
  usuarioController.registrar.bind(usuarioController)
);

export default router;