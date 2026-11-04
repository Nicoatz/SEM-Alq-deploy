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
 *         description: >
 *           Solicitud no aceptada o ya usada, o propiedad con un contrato en curso. Trae `codigo`:
 *           SOLICITUD_NO_ACEPTADA, SOLICITUD_CON_CONTRATO, PROPIEDAD_CON_BORRADOR,
 *           PROPIEDAD_CON_CONTRATO, PROPIEDAD_SIN_OFERTA o CONTRATO_DUPLICADO.
 */
router.post(
  '/',
  authenticateGateway,
  requireRole('locador'),
  contratoController.iniciar.bind(contratoController)
);

/**
 * @openapi
 * /api/v1/contratos:
 *   get:
 *     summary: Listar los contratos del locador (US-43)
 *     description: >
 *       Devuelve los contratos de las propiedades del locador autenticado: borradores, pendientes
 *       de firma, vigentes y finalizados. **No** incluye las ofertas (estado 1), que son las
 *       condiciones de la publicación. Sin DNI ni datos de contacto del locatario o de los garantes.
 *       Orden por defecto: pendientes de firma, borradores y el resto por fecha de fin. Los
 *       filtros por estado, los conteos y la búsqueda los resuelve el cliente sobre esta lista.
 *     tags:
 *       - Contratos
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de contratos (vacía si el locador no tiene).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer }
 *                       codigo: { type: string, nullable: true, description: 'null en los borradores' }
 *                       estado: { type: string, enum: [borrador, pendiente_firma, vigente, finalizado] }
 *                       inmueble:
 *                         type: object
 *                         properties:
 *                           id: { type: integer }
 *                           direccion: { type: string }
 *                           numero: { type: integer }
 *                           piso: { type: string, nullable: true }
 *                           barrio: { type: string }
 *                       locatario:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           nombre: { type: string }
 *                           apellido: { type: string }
 *                       monto_actual: { type: number, nullable: true }
 *                       fecha_inicio_contrato: { type: string, format: date, nullable: true }
 *                       fecha_fin_contrato: { type: string, format: date, nullable: true }
 *                       indice: { type: string, enum: [sin_ajuste, ICL, IPC, CAC] }
 *                       proximo_ajuste: { type: string, format: date, nullable: true }
 *                       id_solicitud: { type: integer, nullable: true }
 *       401:
 *         description: No autorizado.
 *       403:
 *         description: El usuario no tiene rol locador.
 */
router.get(
  '/',
  authenticateGateway,
  requireRole('locador'),
  contratoController.listar.bind(contratoController)
);

/**
 * @openapi
 * /api/v1/contratos/{id}/detalle:
 *   get:
 *     summary: Consultar el detalle de un contrato del locador (US-42)
 *     description: >
 *       Devuelve el contrato ya armado para la pantalla `/panel/contratos/[id]`: partes (con DNI,
 *       correo y teléfono), garantes, condiciones, condiciones de cobro, calendario de ajustes,
 *       estado de cada firma, PDF (URL firmada, vence a los 5 minutos) y acciones disponibles.
 *       Los datos no registrados (contratos anteriores a RentAR) vienen en `null`: el cliente los
 *       muestra como "Sin dato". Un contrato ajeno o inexistente responde siempre 404, sin
 *       distinguir. Un borrador no tiene detalle: responde 409 `CONTRATO_BORRADOR` y el cliente
 *       retoma el alta con `GET /contratos/{id}`.
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
 *         description: Detalle del contrato.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     id: { type: integer }
 *                     codigo: { type: string, nullable: true }
 *                     estado: { type: string, enum: [pendiente_firma, vigente, finalizado] }
 *                     id_solicitud: { type: integer, nullable: true, description: 'Solicitud de origen; null en contratos anteriores a RentAR' }
 *                     inmueble:
 *                       type: object
 *                       properties:
 *                         id: { type: integer }
 *                         direccion: { type: string }
 *                         numero: { type: integer }
 *                         piso: { type: string, nullable: true }
 *                         barrio: { type: string }
 *                         ciudad: { type: string, nullable: true }
 *                     locador: { type: object, nullable: true, description: 'id, nombre, apellido, numero_documento, email, telefono' }
 *                     locatario: { type: object, nullable: true, description: 'id, nombre, apellido, numero_documento, email, telefono' }
 *                     garantes:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id: { type: integer }
 *                           nombre: { type: string }
 *                           apellido: { type: string }
 *                           dni: { type: string }
 *                           email: { type: string }
 *                     condiciones:
 *                       type: object
 *                       properties:
 *                         fecha_inicio_contrato: { type: string, format: date, nullable: true }
 *                         fecha_fin_contrato: { type: string, format: date, nullable: true }
 *                         duracion_meses: { type: integer, nullable: true }
 *                         monto_inicial: { type: number, nullable: true }
 *                         monto_actual: { type: number, nullable: true, description: 'Último ajuste aplicado o, si no hubo, el monto inicial' }
 *                         deposito: { type: number, nullable: true }
 *                         dias_para_vencimiento: { type: integer, nullable: true }
 *                         indice:
 *                           type: object
 *                           nullable: true
 *                           description: null = Sin ajuste
 *                           properties:
 *                             id: { type: integer }
 *                             descripcion: { type: string }
 *                         frecuencia_ajuste: { type: string, nullable: true }
 *                         medios_pago:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               id: { type: integer }
 *                               nombre: { type: string }
 *                         dias_gracia: { type: integer, nullable: true }
 *                         interes_por_dia: { type: number, nullable: true }
 *                     calendario_ajustes:
 *                       type: array
 *                       nullable: true
 *                       description: null si el contrato es "Sin ajuste". El primer ítem es el inicio.
 *                       items:
 *                         type: object
 *                         properties:
 *                           fecha: { type: string, format: date }
 *                           tipo: { type: string, enum: [inicio, ajuste] }
 *                           monto: { type: number, nullable: true, description: 'null = "a definir" (ajuste futuro)' }
 *                     firmas:
 *                       type: object
 *                       properties:
 *                         registradas: { type: boolean, description: 'false si no hay registro de las firmas (contrato anterior a RentAR)' }
 *                         faltan: { type: integer, nullable: true, description: 'Solo con el contrato pendiente de firma' }
 *                         firmado_por_todos_el: { type: string, format: date-time, nullable: true, description: 'Solo con el contrato vigente' }
 *                         firmantes:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               rol: { type: string, enum: [locador, locatario, garante] }
 *                               nombre: { type: string }
 *                               apellido: { type: string }
 *                               estado: { type: string, enum: [pendiente, firmado, rechazado, sin_registro] }
 *                               fecha_firma: { type: string, format: date-time, nullable: true }
 *                               fecha_rechazo: { type: string, format: date-time, nullable: true }
 *                               motivo_rechazo: { type: string, nullable: true }
 *                     pdf:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         nombre: { type: string }
 *                         tamano_bytes: { type: integer }
 *                         subido_en: { type: string, format: date-time }
 *                         url: { type: string, description: 'URL firmada, vence a los 5 minutos' }
 *                     acciones:
 *                       type: object
 *                       properties:
 *                         modificar: { type: boolean }
 *                         firmar: { type: boolean }
 *                         descargar_pdf: { type: boolean }
 *       400:
 *         description: Identificador inválido.
 *       401:
 *         description: No autorizado.
 *       403:
 *         description: El usuario no tiene rol locador.
 *       404:
 *         description: No existe o no es del locador ("No encontramos este contrato.").
 *       409:
 *         description: El contrato es un borrador (`codigo` CONTRATO_BORRADOR); hay que retomarlo en el alta.
 */
router.get(
  '/:id/detalle',
  authenticateGateway,
  requireRole('locador'),
  contratoController.obtenerDetalle.bind(contratoController)
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
 *       Guarda solo lo que viene en el cuerpo; el borrador puede estar incompleto. `garantes`
 *       reemplaza la lista completa. La fecha de fin se calcula en la base
 *       (inicio + duración − 1 día) y no se envía. El PDF del contrato (paso 3) no viaja acá:
 *       ver `/contratos/{id}/pdf`. Solo se puede modificar un contrato en borrador.
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
 *                   duracion_meses: { type: integer, minimum: 1, nullable: true }
 *                   monto_alquiler: { type: integer, minimum: 1, nullable: true }
 *                   deposito: { type: integer, minimum: 0, nullable: true }
 *                   dias_para_vencimiento: { type: integer, minimum: 1, maximum: 28, nullable: true, description: 'Plazo de pago en días (como en US-27), no el día del mes' }
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
 *         description: El contrato ya no está en borrador (`codigo` CONTRATO_NO_EDITABLE).
 */
router.patch(
  '/:id',
  authenticateGateway,
  requireRole('locador'),
  contratoController.guardar.bind(contratoController)
);

/**
 * @openapi
 * /api/v1/contratos/{id}/pdf/url-subida:
 *   post:
 *     summary: URL firmada para subir el PDF del contrato (US-05, paso 3)
 *     description: >
 *       Primer paso de la carga del PDF. Devuelve una URL firmada y un token para que el
 *       navegador suba el archivo **directo a Supabase Storage** (la API en Vercel acepta cuerpos
 *       de hasta 4,5 MB y el PDF puede pesar hasta 5 MB). Después hay que registrarlo con
 *       `PUT /contratos/{id}/pdf`. Cada pedido devuelve una ruta nueva. Solo en borrador.
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
 *         description: Datos de subida (`path`, `token`, `url_firmada`, `tamano_maximo_bytes`).
 *       401:
 *         description: No autorizado.
 *       403:
 *         description: El usuario no tiene rol locador.
 *       404:
 *         description: No existe o no es del locador.
 *       409:
 *         description: El contrato ya no está en borrador (`codigo` CONTRATO_NO_EDITABLE).
 */
router.post(
  '/:id/pdf/url-subida',
  authenticateGateway,
  requireRole('locador'),
  contratoController.urlSubidaPdf.bind(contratoController)
);

/**
 * @openapi
 * /api/v1/contratos/{id}/pdf:
 *   put:
 *     summary: Registrar el PDF del contrato ya subido a Storage (US-05, paso 3)
 *     description: >
 *       Segundo paso de la carga. La API descarga el archivo de la ruta indicada, verifica que
 *       sea un PDF de hasta 5 MB, calcula su hash y lo registra en el borrador. Si ya había un
 *       PDF, lo reemplaza y borra el anterior. Un archivo inválido se elimina de Storage.
 *       Devuelve el contrato completo, con `pdf.url` (firmada, vence a los 5 minutos) para la
 *       vista previa del paso 4.
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
 *             required: [path, nombre]
 *             properties:
 *               path:
 *                 type: string
 *                 description: La `path` que devolvió url-subida.
 *               nombre:
 *                 type: string
 *                 description: Nombre del archivo original (debe terminar en .pdf).
 *     responses:
 *       200:
 *         description: PDF registrado; devuelve el contrato completo.
 *       400:
 *         description: Ruta ajena o inválida, archivo no encontrado o que no es un PDF.
 *       401:
 *         description: No autorizado.
 *       403:
 *         description: El usuario no tiene rol locador.
 *       404:
 *         description: No existe o no es del locador.
 *       409:
 *         description: El contrato ya no está en borrador (`codigo` CONTRATO_NO_EDITABLE).
 *       413:
 *         description: El PDF supera los 5 MB.
 */
router.put(
  '/:id/pdf',
  authenticateGateway,
  requireRole('locador'),
  contratoController.registrarPdf.bind(contratoController)
);

/**
 * @openapi
 * /api/v1/contratos/{id}/reabrir:
 *   post:
 *     summary: Modificar un contrato pendiente de firma (US-06)
 *     description: >
 *       Vuelve a borrador un contrato pendiente de firma **sin la firma del locatario**. Cancela el
 *       envío, borra las firmas registradas (partes y garantes, y los enlaces de los garantes) y
 *       conserva el código CT-AAAA-NNNN. Después se edita con `PATCH /contratos/{id}` (los mismos
 *       4 pasos y validaciones que el alta). **El cliente debe pedir confirmación al locador antes
 *       de llamar**, avisando las tres consecuencias.
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
 *         description: El contrato volvió a borrador; devuelve el contrato completo.
 *       400:
 *         description: Identificador inválido.
 *       401:
 *         description: No autorizado.
 *       403:
 *         description: El usuario no tiene rol locador.
 *       404:
 *         description: No existe o no es del locador ("No encontramos este contrato.").
 *       409:
 *         description: >
 *           No se puede modificar. Trae `codigo` con el motivo: CONTRATO_VIGENTE,
 *           CONTRATO_FINALIZADO, CONTRATO_FIRMADO_POR_LOCATARIO o CONTRATO_YA_EN_BORRADOR
 *           (un borrador se retoma directo con `GET` y `PATCH`).
 */
router.post(
  '/:id/reabrir',
  authenticateGateway,
  requireRole('locador'),
  contratoController.reabrir.bind(contratoController)
);

/**
 * @openapi
 * /api/v1/contratos/{id}:
 *   delete:
 *     summary: Descartar un borrador de contrato (US-06)
 *     description: >
 *       Elimina un contrato en borrador con sus garantes, partes, PDF. La solicitud
 *       aceptada de origen queda libre y puede originar un contrato nuevo (`POST /contratos`).
 *       **El cliente debe pedir confirmación antes de llamar.** Solo borradores.
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
 *         description: Borrador descartado.
 *       400:
 *         description: Identificador inválido.
 *       401:
 *         description: No autorizado.
 *       403:
 *         description: El usuario no tiene rol locador.
 *       404:
 *         description: No existe o no es del locador.
 *       409:
 *         description: El contrato ya no está en borrador (`codigo` CONTRATO_NO_EDITABLE).
 */
router.delete(
  '/:id',
  authenticateGateway,
  requireRole('locador'),
  contratoController.descartar.bind(contratoController)
);

export default router;
