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
  requireRole("locador"),
  inmuebleController.create.bind(inmuebleController)
);

router.put(
  "/:id",
  authenticateGateway,
  requireRole("locador"),
  inmuebleController.update.bind(inmuebleController)
);

router.delete(
  "/:id",
  authenticateGateway,
  requireRole("locador"),
  inmuebleController.delete.bind(inmuebleController)
);

export default router;

