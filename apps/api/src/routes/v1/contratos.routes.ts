import { Router } from 'express';

import { contratoController } from '../../controllers/contrato.controller';
import { authenticateGateway, requireRole } from '../../gateway/middlewares/auth.middleware';

const router = Router();

/**
 * @openapi
 * /api/v1/contratos:
 *   post:
 *     summary: Iniciar un contrato de alquiler (US-05)
 *     description: >
 *       Crea el contrato en estado borrador a partir de una solicitud aceptada. Precarga las
 *       condiciones de la oferta de la propiedad (que no se modifica), los medios de pago y las
 *       partes (locador y locatario). La solicitud debe ser del locador autenticado, estar
 *       aceptada y no haber originado otro contrato; la propiedad no puede tener un contrato
 *       vigente, pendiente de firma ni en borrador.
 *     tags:
 *       - Contratos
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id_solicitud]
 *             properties:
 *               id_solicitud:
 *                 type: integer
 *                 minimum: 1
 *     responses:
 *       201:
 *         description: Contrato creado en estado borrador.
 *       400:
 *         description: id_solicitud inválido.
 *       401:
 *         description: No autorizado.
 *       403:
 *         description: El usuario no tiene rol locador.
 *       404:
 *         description: La solicitud no existe, no es del locador o la propiedad no existe.
 *       409:
 *         description: Solicitud no aceptada o ya usada, o propiedad con un contrato en curso.
 */
router.post(
  '/',
  authenticateGateway,
  requireRole('locador'),
  contratoController.iniciar.bind(contratoController)
);

/**
 * @openapi
 * /api/v1/contratos/{id}:
 *   get:
 *     summary: Consultar un contrato en curso del locador (US-05)
 *     description: >
 *       Devuelve el contrato con las partes, los garantes, las condiciones, las cláusulas y las
 *       garantías que el locatario ofreció en su solicitud. Sirve para retomar un borrador.
 *       Un contrato ajeno o inexistente responde siempre 404.
 *     tags:
 *       - Contratos
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       200:
 *         description: Contrato del locador.
 *       400:
 *         description: Identificador inválido.
 *       401:
 *         description: No autorizado.
 *       403:
 *         description: El usuario no tiene rol locador.
 *       404:
 *         description: No existe o no es del locador.
 */
router.get(
  '/:id',
  authenticateGateway,
  requireRole('locador'),
  contratoController.obtener.bind(contratoController)
);

/**
 * @openapi
 * /api/v1/contratos/{id}:
 *   patch:
 *     summary: Guardar el borrador del contrato desde cualquier paso (US-05)
 *     description: >
 *       Guarda solo lo que viene en el cuerpo; el borrador puede estar incompleto. `garantes` y
 *       `clausulas` reemplazan la lista completa. La fecha de fin se calcula en la base
 *       (inicio + duración − 1 día) y no se envía. Solo se puede modificar un contrato en
 *       borrador.
 *     tags:
 *       - Contratos
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               paso:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 4
 *               condiciones:
 *                 type: object
 *                 properties:
 *                   fecha_inicio_contrato: { type: string, format: date, nullable: true }
 *                   duracion_meses: { type: integer, minimum: 1 }
 *                   monto_alquiler: { type: integer, minimum: 1 }
 *                   deposito: { type: integer, minimum: 0, nullable: true }
 *                   dias_para_vencimiento: { type: integer, minimum: 1, maximum: 28 }
 *                   indice_aumento: { type: integer, nullable: true, description: null = Sin ajuste }
 *                   frecuencia_ajuste: { type: string, enum: [trimestral, semestral, anual], nullable: true }
 *               garantes:
 *                 type: array
 *                 maxItems: 3
 *                 items:
 *                   type: object
 *                   required: [nombre, apellido, dni, email]
 *                   properties:
 *                     nombre: { type: string }
 *                     apellido: { type: string }
 *                     dni: { type: string, pattern: '^[0-9]{7,8}$' }
 *                     email: { type: string, format: email }
 *               clausulas:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [clave, tipo, titulo, texto]
 *                   properties:
 *                     clave: { type: string }
 *                     tipo: { type: string, enum: [fija, editable, propia] }
 *                     titulo: { type: string }
 *                     texto: { type: string, description: 'Hasta 1.000 caracteres si es editable o propia' }
 *                     editada: { type: boolean }
 *     responses:
 *       200:
 *         description: Borrador guardado; devuelve el contrato completo.
 *       400:
 *         description: Algún dato no cumple las reglas de la US-05.
 *       401:
 *         description: No autorizado.
 *       403:
 *         description: El usuario no tiene rol locador.
 *       404:
 *         description: No existe o no es del locador.
 *       409:
 *         description: El contrato ya no está en borrador.
 */
router.patch(
  '/:id',
  authenticateGateway,
  requireRole('locador'),
  contratoController.guardar.bind(contratoController)
);

export default router;
