import { Router } from 'express';

import { firmaController } from '../../controllers/firma.controller';
import { limitarSolicitudes } from '../../gateway/middlewares/rate-limit.middleware';

const router = Router();

// Rutas públicas (el garante no tiene sesión): el enlace es su credencial. Se limita por IP porque
// cada intento válido cuesta una llamada a DocuSign.
const limitador = limitarSolicitudes({ maximo: 30, ventanaMs: 10 * 60 * 1000 });

/**
 * @openapi
 * /api/v1/firma-garante/{token}:
 *   get:
 *     summary: Consultar el enlace de firma de un garante (US-07)
 *     description: >
 *       **Público, sin sesión.** El garante abre el enlace que le entregó el locador y ve qué va a
 *       firmar: su nombre, la propiedad y el código del contrato. Nunca devuelve DNI, montos ni
 *       datos del locador o del locatario. Un enlace inexistente, vencido (dura 2 días) o ya usado
 *       responde **siempre lo mismo** (404), sin distinguir el motivo.
 *     tags:
 *       - Firma de contratos
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: El enlace sirve.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     garante:
 *                       type: object
 *                       properties:
 *                         nombre: { type: string }
 *                         apellido: { type: string }
 *                     contrato:
 *                       type: object
 *                       properties:
 *                         codigo: { type: string, nullable: true, example: CT-2026-0001 }
 *                         propiedad: { type: string, example: "Colón 100, Centro" }
 *                     vence_en: { type: string, format: date-time, nullable: true }
 *       404:
 *         description: El enlace no es válido o ya no está disponible.
 *       429:
 *         description: Demasiados intentos desde la misma IP.
 */
router.get('/:token', limitador, firmaController.consultarEnlaceGarante.bind(firmaController));

/**
 * @openapi
 * /api/v1/firma-garante/{token}/firmar:
 *   post:
 *     summary: Firmar como garante (US-07)
 *     description: >
 *       **Público, sin sesión.** Devuelve la URL de DocuSign donde el garante firma el contrato; el
 *       cliente lo redirige ahí. La firma se registra cuando DocuSign avisa que se completó, no
 *       cuando el navegador vuelve. Mientras no firme puede volver a abrir el enlace. Los garantes
 *       solo pueden firmar: no pueden rechazar.
 *     tags:
 *       - Firma de contratos
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [acepta_condiciones]
 *             properties:
 *               acepta_condiciones:
 *                 type: boolean
 *                 enum: [true]
 *                 description: La casilla "Leí el contrato completo y acepto sus condiciones y cláusulas".
 *     responses:
 *       200:
 *         description: URL de firma.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     url: { type: string }
 *       400:
 *         description: Falta aceptar las condiciones (`FALTA_ACEPTAR_CONDICIONES`).
 *       404:
 *         description: El enlace no es válido o ya no está disponible.
 *       429:
 *         description: Demasiados intentos desde la misma IP.
 *       502:
 *         description: DocuSign no respondió; se puede reintentar.
 */
router.post('/:token/firmar', limitador, firmaController.firmarGarante.bind(firmaController));

export default router;
