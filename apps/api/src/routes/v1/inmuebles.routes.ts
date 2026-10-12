import { Router } from "express";
import { inmuebleController } from "../../controllers/inmueble.controller";
import { authenticateGateway, requireRole } from "../../gateway/middlewares/auth.middleware";

const router = Router();

router.get("/", inmuebleController.getAll.bind(inmuebleController));
/**
 * @openapi
 * /api/v1/inmuebles/disponibles:
 *   get:
 *     summary: Obtener propiedades disponibles
 *     description: Obtiene las propiedades disponibles para alquilar, permitiendo filtrar, ordenar y paginar los resultados.
 *     tags:
 *       - Inmuebles
 *     parameters:
 *       - in: query
 *         name: barrio
 *         schema:
 *           type: string
 *         description: Barrio por el cual filtrar.
 *
 *       - in: query
 *         name: precioMin
 *         schema:
 *           type: number
 *         description: Precio mínimo del alquiler mensual.
 *
 *       - in: query
 *         name: precioMax
 *         schema:
 *           type: number
 *         description: Precio máximo del alquiler mensual.
 *
 *       - in: query
 *         name: tipo
 *         schema:
 *           type: integer
 *         description: ID del tipo de inmueble.
 *
 *       - in: query
 *         name: dormitorios
 *         schema:
 *           type: integer
 *         description: Cantidad de dormitorios.
 *
 *       - in: query
 *         name: ambientes
 *         schema:
 *           type: integer
 *         description: Cantidad de ambientes.
 *
 *       - in: query
 *         name: superficieMin
 *         schema:
 *           type: number
 *         description: Superficie mínima en m².
 *
 *       - in: query
 *         name: superficieMax
 *         schema:
 *           type: number
 *         description: Superficie máxima en m².
 *
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *           example: "1,3"
 *         description: IDs de los tags separados por coma. Se devuelve el inmueble si coincide con cualquiera de los tags.
 *
 *       - in: query
 *         name: indiceAjuste
 *         schema:
 *           type: integer
 *         description: ID del índice de ajuste.
 *
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Número de página.
 *
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 10
 *         description: Cantidad de resultados por página.
 *
 *       - in: query
 *         name: orden
 *         schema:
 *           type: string
 *           enum:
 *             - precio
 *             - dormitorios
 *             - m2
 *         description: Criterio de ordenamiento.
 *
 *       - in: query
 *         name: direccion
 *         schema:
 *           type: string
 *           enum:
 *             - asc
 *             - desc
 *           default: asc
 *         description: Dirección del ordenamiento.
 *
 *     responses:
 *       200:
 *         description: Propiedades disponibles obtenidas exitosamente.
 *       500:
 *         description: Error interno del servidor.
 */
router.get(
  "/disponibles",
  inmuebleController.getInmueblesDisponibles.bind(inmuebleController)
);
/**
 * @openapi
 * /api/v1/inmuebles/disponibles/{id}:
 *   get:
 *     summary: Consultar el detalle de una propiedad disponible
 *     tags:
 *       - Inmuebles
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del inmueble
 *     responses:
 *       200:
 *         description: Detalle de la propiedad disponible
 *       400:
 *         description: El ID proporcionado no es válido
 *       404:
 *         description: Inmueble no encontrado o no disponible
 */
router.get("/disponibles/:id", inmuebleController.getById.bind(inmuebleController));

router.post(
  "/",
  authenticateGateway,
  inmuebleController.create.bind(inmuebleController)
);

/**
 * @openapi
 * /api/v1/inmuebles/{id}:
 *   put:
 *     summary: Modificar una propiedad (US)
 *     description: |
 *       Permite al locador propietario modificar los datos editables de un inmueble,
 *       incluyendo sus fotos y tags.
 *
 *       Las fotos y los tags enviados reemplazan las colecciones existentes.
 *       No se permite modificar el estado de alquiler ni los datos del contrato.
 *       Tampoco se permite modificar una propiedad que se encuentre alquilada
 *       o publicada/alquilada.
 *     tags:
 *       - Inmuebles
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Identificador del inmueble que se desea modificar.
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
 *               tipo:
 *                 type: integer
 *                 description: ID del tipo de inmueble.
 *                 example: 2
 *               descripcion:
 *                 type: string
 *                 nullable: true
 *                 example: Departamento luminoso con balcón.
 *               provincia:
 *                 type: string
 *                 example: Córdoba
 *               ciudad:
 *                 type: string
 *                 example: Córdoba
 *               barrio:
 *                 type: string
 *                 example: Nueva Córdoba
 *               direccion:
 *                 type: string
 *                 example: Av. Vélez Sarsfield
 *               numero:
 *                 type: integer
 *                 example: 1234
 *               piso:
 *                 type: string
 *                 nullable: true
 *                 example: "4"
 *               m2_totales:
 *                 type: number
 *                 example: 75
 *               m2_cubiertos:
 *                 type: number
 *                 example: 65
 *               ambientes:
 *                 type: integer
 *                 example: 3
 *               dormitorios:
 *                 type: integer
 *                 example: 2
 *               banos:
 *                 type: integer
 *                 example: 1
 *               antiguedad:
 *                 type: integer
 *                 nullable: true
 *                 example: 10
 *               precio_publicado:
 *                 type: number
 *                 description: Precio publicado del inmueble.
 *                 example: 350000
 *               fecha_disponible:
 *                 type: string
 *                 format: date
 *                 nullable: true
 *                 example: "2026-11-01"
 *               servicios:
 *                 type: integer
 *                 nullable: true
 *                 description: ID del servicio, si corresponde.
 *                 example: 1
 *               fotos:
 *                 type: array
 *                 description: |
 *                   Lista completa de fotos que tendrá el inmueble.
 *                   Si se envía, reemplaza las fotos existentes.
 *                   Se requieren entre 3 y 50 fotos y como máximo una principal.
 *                 minItems: 3
 *                 maxItems: 50
 *                 items:
 *                   type: object
 *                   required:
 *                     - url
 *                     - peso_kb
 *                     - formato
 *                   properties:
 *                     url:
 *                       type: string
 *                       example: https://ejemplo.com/foto.jpg
 *                     peso_kb:
 *                       type: number
 *                       example: 350
 *                     formato:
 *                       type: string
 *                       example: jpg
 *                     es_principal:
 *                       type: boolean
 *                       default: false
 *                       example: true
 *               tags:
 *                 type: array
 *                 description: |
 *                   Lista completa de IDs de tags del inmueble.
 *                   Si se envía como un array vacío, se eliminan los tags existentes.
 *                 items:
 *                   type: integer
 *                 example:
 *                   - 1
 *                   - 3
 *           example:
 *             descripcion: Departamento luminoso con balcón.
 *             barrio: Nueva Córdoba
 *             direccion: Av. Vélez Sarsfield
 *             numero: 1234
 *             piso: "4"
 *             m2_totales: 75
 *             m2_cubiertos: 65
 *             ambientes: 3
 *             dormitorios: 2
 *             banos: 1
 *             precio_publicado: 350000
 *             fotos:
 *               - url: https://ejemplo.com/foto1.jpg
 *                 peso_kb: 350
 *                 formato: jpg
 *                 es_principal: true
 *               - url: https://ejemplo.com/foto2.jpg
 *                 peso_kb: 280
 *                 formato: jpg
 *                 es_principal: false
 *               - url: https://ejemplo.com/foto3.jpg
 *                 peso_kb: 310
 *                 formato: jpg
 *                 es_principal: false
 *             tags:
 *               - 1
 *               - 3
 *     responses:
 *       200:
 *         description: Inmueble actualizado exitosamente.
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
 *                   example: Inmueble actualizado exitosamente.
 *                 data:
 *                   type: object
 *                   description: Datos del inmueble actualizado.
 *       400:
 *         description: ID inválido o datos enviados incorrectos.
 *       401:
 *         description: No autorizado. Se requiere un token válido.
 *       403:
 *         description: El inmueble no pertenece al locador autenticado o el usuario no tiene el rol requerido.
 *       404:
 *         description: Inmueble inexistente o inactivo.
 *       409:
 *         description: No se permite modificar el inmueble debido a su estado actual.
 *       500:
 *         description: Error interno del servidor.
 */
router.put(
  "/:id",
  authenticateGateway,
  requireRole("locador"),
  inmuebleController.update.bind(inmuebleController)
);

/**
 * @openapi
 * /api/v1/inmuebles/{id}:
 *   delete:
 *     summary: Eliminar lógicamente un inmueble (US-04)
 *     description: |
 *       Inactiva un inmueble sin eliminarlo físicamente de la base de datos.
 *       Los contratos asociados se marcan como finalizados (estado 3) e inactivos.
 *       Solo puede realizar esta operación el locador propietario del inmueble.
 *       No se permite eliminar inmuebles en estado alquilado o publicado/alquilado.
 *     tags:
 *       - Inmuebles
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identificador del inmueble.
 *     responses:
 *       200:
 *         description: Inmueble eliminado correctamente.
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
 *                   example: Inmueble eliminado correctamente.
 *       400:
 *         description: ID inválido.
 *       401:
 *         description: No autorizado. Se requiere un token válido.
 *       403:
 *         description: El usuario no tiene permiso para eliminar este inmueble o no posee el rol locador.
 *       404:
 *         description: Inmueble inexistente o inactivo.
 *       409:
 *         description: No se permite eliminar el inmueble debido a su estado actual.
 *       500:
 *         description: Error interno del servidor.
 */

router.delete(
  "/:id",
  authenticateGateway,
  requireRole("locador"),
  inmuebleController.delete.bind(inmuebleController)
);

export default router;

