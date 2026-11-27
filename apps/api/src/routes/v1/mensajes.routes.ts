import { Router } from 'express';

import { mensajeController } from '../../controllers/mensaje.controller';
import { authenticateGateway } from '../../gateway/middlewares/auth.middleware';

const router = Router();

// Todas las operaciones de mensajería requieren sesión iniciada (Criterio US-24)
router.use(authenticateGateway);

/**
 * @openapi
 * /api/v1/mensajes/conversaciones:
 *   post:
 *     summary: Iniciar una conversación (US-24)
 *     description: Inicia una nueva conversación entre locador y locatario.
 *     tags:
 *       - Mensajería
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id_destinatario
 *               - asunto
 *             properties:
 *               id_destinatario:
 *                 type: integer
 *               asunto:
 *                 type: string
 *               tipo_tema:
 *                 type: string
 *                 enum: [general, inmueble, reclamo, contrato]
 *               id_inmueble:
 *                 type: integer
 *               id_reclamo:
 *                 type: integer
 *               id_contrato:
 *                 type: integer
 *               primer_mensaje:
 *                 type: string
 *     responses:
 *       200:
 *         description: Conversación existente reutilizada.
 *       201:
 *         description: Conversación creada exitosamente.
 *       400:
 *         description: Datos inválidos o mensaje vacío.
 *       403:
 *         description: El locador no puede iniciar conversación sin contrato vigente.
 */
router.post('/conversaciones', mensajeController.crearConversacion.bind(mensajeController));

/**
 * @openapi
 * /api/v1/mensajes/conversaciones:
 *   get:
 *     summary: Listar conversaciones del usuario autenticado (US-24)
 *     description: Lista conversaciones generales, de inmuebles y contratos; las conversaciones de reclamos se consultan desde el detalle del reclamo.
 *     tags:
 *       - Mensajería
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de conversaciones con último mensaje y participantes.
 */
router.get('/conversaciones', mensajeController.listarConversaciones.bind(mensajeController));

/**
 * @openapi
 * /api/v1/mensajes/conversaciones/{id}:
 *   get:
 *     summary: Obtener detalle de una conversación (US-24)
 *     tags:
 *       - Mensajería
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Detalle de la conversación.
 *       403:
 *         description: No participa en la conversación.
 *       404:
 *         description: Conversación no encontrada.
 */
router.get('/conversaciones/:id', mensajeController.obtenerConversacion.bind(mensajeController));

/**
 * @openapi
 * /api/v1/mensajes/conversaciones/{id}/mensajes:
 *   get:
 *     summary: Listar mensajes de una conversación (US-24)
 *     description: Devuelve hasta los últimos 100 mensajes ordenados cronológicamente.
 *     tags:
 *       - Mensajería
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Historial de mensajes (hasta 100).
 *       403:
 *         description: No participa en la conversación.
 *       404:
 *         description: Conversación no encontrada.
 */
router.get('/conversaciones/:id/mensajes', mensajeController.listarMensajes.bind(mensajeController));

/**
 * @openapi
 * /api/v1/mensajes/conversaciones/{id}/mensajes:
 *   post:
 *     summary: Enviar un mensaje (US-24)
 *     description: Envía un nuevo mensaje en una conversación existente.
 *     tags:
 *       - Mensajería
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - contenido
 *             properties:
 *               contenido:
 *                 type: string
 *     responses:
 *       201:
 *         description: Mensaje enviado exitosamente.
 *       400:
 *         description: Mensaje vacío o compuesto únicamente por espacios en blanco.
 *       403:
 *         description: No participa en la conversación.
 */
router.post('/conversaciones/:id/mensajes', mensajeController.enviarMensaje.bind(mensajeController));

/**
 * @openapi
 * /api/v1/mensajes/{id}:
 *   delete:
 *     summary: Eliminar un mensaje propio (US-24)
 *     description: Permite eliminar un mensaje propio ya enviado. No se permite eliminar mensajes del otro participante.
 *     tags:
 *       - Mensajería
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Mensaje eliminado exitosamente.
 *       403:
 *         description: Intento de eliminar mensaje del otro participante.
 *       404:
 *         description: Mensaje no encontrado.
 */
router.delete('/:id', mensajeController.eliminarMensaje.bind(mensajeController));

export default router;
