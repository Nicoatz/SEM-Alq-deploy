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



/**
 * @openapi
 * /api/v1/usuarios/me:
 *   patch:
 *     summary: Actualizar mi perfil
 *     description: |
 *       Permite al usuario autenticado actualizar sus datos personales.
 *       Solo se actualizan los campos enviados en el body.
 *
 *       El nombre, apellido y número de documento no pueden modificarse
 *       si el usuario participa en un contrato vigente o pendiente de firma,
 *       debido a que son datos de identificación asociados al contrato.
 *
 *       El email se modifica mediante un endpoint separado.
 *     tags:
 *       - Usuarios
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             minProperties: 1
 *             additionalProperties: false
 *             properties:
 *               nombre:
 *                 type: string
 *                 example: María
 *                 description: Nuevo nombre. No modificable si existe un contrato bloqueante.
 *               apellido:
 *                 type: string
 *                 example: González
 *                 description: Nuevo apellido. No modificable si existe un contrato bloqueante.
 *               numero_documento:
 *                 type: string
 *                 example: "40123456"
 *                 description: Nuevo número de documento. No modificable si existe un contrato bloqueante.
 *               telefono:
 *                 type: string
 *                 pattern: '^\\+[1-9]\\d{9,14}$'
 *                 example: "+5493511234567"
 *                 description: Número en formato internacional E.164, comenzando con + y seguido de entre 10 y 15 dígitos en total.
 *               fecha_nacimiento:
 *                 type: string
 *                 format: date
 *                 example: "1995-06-15"
 *                 description: Fecha real en formato AAAA-MM-DD. El usuario debe tener al menos 18 años.
 *           examples:
 *             actualizarTelefono:
 *               summary: Actualizar teléfono
 *               value:
 *                 telefono: "+5493511234567"
 *             actualizarDatosPersonales:
 *               summary: Actualizar datos personales
 *               value:
 *                 nombre: María
 *                 apellido: González
 *                 telefono: "+5493511234567"
 *                 fecha_nacimiento: "1995-06-15"
 *     responses:
 *       200:
 *         description: Datos del perfil actualizados exitosamente.
 *       400:
 *         description: |
 *           Datos inválidos, body vacío, campos no permitidos,
 *           teléfono inválido o fecha de nacimiento inválida o menor de 18 años.
 *       401:
 *         description: No autorizado. Se requiere autenticación.
 *       404:
 *         description: No se encontró el perfil del usuario autenticado.
 *       409:
 *         description: |
 *           No se puede modificar el nombre, apellido o DNI porque el usuario
 *           participa en un contrato vigente o pendiente de firma.
 *           También puede producirse un conflicto si el número de documento
 *           ya está registrado.
 */

router.patch(
  '/me',
  authenticateGateway,
  usuarioController.actualizarMiPerfil.bind(usuarioController)
);

export default router;