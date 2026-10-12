import { Router } from 'express';

import { solicitudController } from '../../controllers/solicitud.controller';
import { authenticateGateway } from '../../gateway/middlewares/auth.middleware';

const router = Router();

/**
 * @openapi
 * /api/v1/solicitudes/mias:
 *   get:
 *     summary: Consultar solicitudes enviadas por el locatario
 *     description: Devuelve las solicitudes del usuario autenticado, ordenadas de la más nueva a la más antigua.
 *     tags:
 *       - Solicitudes
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *           enum: [pendiente, aceptada, rechazada, cancelada]
 *         description: Filtra las solicitudes por estado.
 *       - in: query
 *         name: inmueble
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Filtra las solicitudes de una propiedad.
 *     responses:
 *       200:
 *         description: Solicitudes del usuario autenticado.
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
 *                     $ref: '#/components/schemas/SolicitudResponse'
 *       400:
 *         description: Filtros inválidos.
 *       401:
 *         description: No autorizado.
 */
router.get(
  '/mias',
  authenticateGateway,
  solicitudController.getMisSolicitudes.bind(solicitudController)
);

/**
 * @openapi
 * /api/v1/solicitudes/preparar:
 *   get:
 *     summary: Obtener datos para preparar una solicitud de alquiler
 *     description: Devuelve el perfil del locatario, catálogos y valores iniciales del formulario.
 *     tags:
 *       - Solicitudes
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: id_inmueble
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Identificador de la propiedad a solicitar.
 *     responses:
 *       200:
 *         description: Datos iniciales de la solicitud.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     usuario:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         nombre:
 *                           type: string
 *                         apellido:
 *                           type: string
 *                           nullable: true
 *                         dni:
 *                           type: string
 *                           nullable: true
 *                         telefono:
 *                           type: string
 *                           nullable: true
 *                         email:
 *                           type: string
 *                           format: email
 *                     situaciones_ocupacionales:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           codigo:
 *                             type: string
 *                             enum: [sin_informar, relacion_dependencia, monotributista, autonoma, estudiante, jubilada]
 *                           nombre:
 *                             type: string
 *                     garantias:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           codigo:
 *                             type: string
 *                             enum: [propietaria, caucion, otra]
 *                           nombre:
 *                             type: string
 *                     garantias_exigidas:
 *                       type: array
 *                       items:
 *                         type: integer
 *                       description: IDs de garantías exigidas por el inmueble. Actualmente vacío hasta persistir esa relación.
 *                     valores_iniciales:
 *                       type: object
 *                       properties:
 *                         telefono:
 *                           type: string
 *                         email:
 *                           type: string
 *                           format: email
 *                         ocupacion:
 *                           type: string
 *                           enum: [sin_informar]
 *                         ingresos:
 *                           type: integer
 *                           nullable: true
 *                         convivientes:
 *                           type: integer
 *                           example: 1
 *                         mascotas:
 *                           type: boolean
 *                           example: false
 *                         detalle_mascotas:
 *                           type: string
 *                           nullable: true
 *                         garantias:
 *                           type: array
 *                           items:
 *                             type: string
 *                         acepto:
 *                           type: boolean
 *                           example: false
 *       400:
 *         description: El identificador es inválido.
 *       401:
 *         description: No autorizado.
 *       403:
 *         description: El usuario es propietario de la propiedad.
 *       404:
 *         description: La propiedad no existe.
 *       409:
 *         description: La propiedad no recibe solicitudes.
 */
router.get(
  '/preparar',
  authenticateGateway,
  solicitudController.prepare.bind(solicitudController)
);

/**
 * @openapi
 * /api/v1/solicitudes:
 *   post:
 *     summary: Enviar una solicitud de alquiler
 *     description: Crea una solicitud de alquiler para una propiedad disponible, validando sesión, propietario, garantías y reglas de negocio.
 *     tags:
 *       - Solicitudes
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
 *               - telefono
 *               - email
 *               - ocupacion
 *               - ingresos
 *               - convivientes
 *               - mascotas
 *               - detalle_mascotas
 *               - garantias
 *               - acepta_condiciones
 *             properties:
 *               id_inmueble:
 *                 type: integer
 *                 example: 12
 *               mensaje:
 *                 type: string
 *                 maxLength: 600
 *                 example: "Estoy muy interesado en la propiedad."
 *               telefono:
 *                 type: string
 *                 example: "+5493511234567"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "juan.perez@email.com"
 *               ocupacion:
 *                 type: string
 *                 enum: [sin_informar, relacion_dependencia, monotributista, autonoma, estudiante, jubilada]
 *                 default: sin_informar
 *               ingresos:
 *                 type: integer
 *                 minimum: 1
 *                 nullable: true
 *                 description: Entero mayor que cero; null indica que el usuario no informa sus ingresos. El valor 0 recibido por compatibilidad se persiste como null.
 *                 example: 120000
 *               convivientes:
 *                 type: integer
 *                 minimum: 1
 *                 example: 2
 *               mascotas:
 *                 type: boolean
 *                 example: false
 *               detalle_mascotas:
 *                 type: string
 *                 maxLength: 300
 *                 nullable: true
 *                 example: "Tengo 1 perro mediano."
 *               garantias:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [propietaria, caucion, otra]
 *                 example: [propietaria, caucion]
 *               acepta_condiciones:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       201:
 *         description: Solicitud creada exitosamente.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SolicitudResponse'
 *       400:
 *         description: Datos de la solicitud inválidos.
 *       401:
 *         description: No autorizado.
 *       403:
 *         description: El usuario es propietario de la propiedad.
 *       404:
 *         description: La propiedad no existe.
 *       409:
 *         description: Ya existe una solicitud activa para la misma propiedad.
 */
router.post(
  '/',
  authenticateGateway,
  solicitudController.create.bind(solicitudController)
);

export default router;
