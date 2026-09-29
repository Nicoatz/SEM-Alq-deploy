/**
 * shared/backend-dtos.ts — copias de DTOs del back que `@rentar/shared-types`
 * todavía no exporta.
 *
 * Qué es: la forma exacta de algunas respuestas y cuerpos de `apps/api` que
 * viven solo en `apps/api/src/` (controllers o `dtos/`). El frontend no puede
 * importar de `apps/api`, así que se copian acá, campo por campo. Lo que sí
 * exporta `@rentar/shared-types` (`Inmueble`, `MisAlquileresItem`,
 * `CreateInmuebleCompletoPayload`, `Usuario`) se importa de ahí, no se copia.
 * TODO(backend): mover estos DTOs a `@rentar/shared-types` y reemplazar esta
 * copia por un import.
 *
 * Quién lo usa: la rama real de los services y los adaptadores.
 */

/**
/**
 * Respuesta de `GET /api/v1/usuarios/me` (existe): el usuario del token con
 * sus roles. Copia del `data` que arma `usuarioController.obtenerMiPerfil`
 * (`apps/api/src/controllers/usuario.controller.ts`).
 */
export interface UsuarioMeResponse {
  id: number
  nombre: string
  apellido?: string | null
  email: string
  /** Descripciones de la tabla `rol`: `'locatario'`, `'locador'` o `'administrador'`. */
  roles: string[]
}

/** Un valor de catálogo como lo devuelve el back (`tipo_inmueble`, `tipo_indice`, `tags_inmueble`). */
export interface CatalogoRef {
  id: number
  descripcion: string
}

/**
 * Un item de `GET /api/v1/inmuebles/disponibles` (existe). Copia de
 * `InmuebleDisponibleDTO` de `apps/api/src/dtos/inmueble.dto.ts`.
 * NOTA: `precio`, `expensas` e `indice_ajuste` salen del contrato del
 * inmueble; el back solo lista los inmuebles que tienen contrato.
 */
export interface InmuebleDisponibleResponse {
  id: number
  tipo: CatalogoRef
  direccion: string
  numero: number
  piso?: string | null
  ciudad: string
  barrio: string
  provincia: string
  ambientes: number
  dormitorios: number
  banos: number
  m2_totales: number
  m2_cubiertos: number
  descripcion?: string | null
  precio: number
  /** `null` sin contrato (desde el 29/09); antes `0` o `-1`. */
  expensas: number | null
  indice_ajuste: CatalogoRef | null
  fecha_disponible?: string | null
  tags: CatalogoRef[]
  /** URL de la foto principal (o de la primera); `null` si no tiene fotos. */
  foto_principal: string | null
}

/**
 * Respuesta de `GET /api/v1/inmuebles/disponibles` (existe, paginada desde el
 * 26/09). Copia de `InmueblesDisponiblesResultadoDTO`.
 */
export interface InmueblesDisponiblesResponse {
  items: InmuebleDisponibleResponse[]
  total: number
  page: number
  limit: number
  totalPages: number
}

/**
 * Query params de `GET /api/v1/inmuebles/disponibles`, con los nombres del
 * back. Todos van como texto en la URL.
 * NOTA: hoy el front manda solo `page` y `limit`: el back ignora el resto de
 * los filtros (ver `propiedades.service.ts#buscarPropiedades`). Quedan
 * documentados para cuando los respete.
 */
export interface DisponiblesQuery {
  barrio?: string
  precioMin?: string
  precioMax?: string
  /** `tipo_inmueble.id`. */
  tipo?: string
  /** Cantidad exacta. */
  dormitorios?: string
  /** Cantidad exacta. */
  ambientes?: string
  superficieMin?: string
  superficieMax?: string
  /** Ids de `tags_inmueble` separados por coma; el back devuelve los que tengan CUALQUIERA. */
  tags?: string
  /** `tipo_indice.id`. */
  indiceAjuste?: string
  page?: string
  limit?: string
  orden?: 'precio' | 'dormitorios' | 'm2'
  direccion?: 'asc' | 'desc'
}

/**
 * Respuesta de `GET /api/v1/inmuebles/disponibles/:id` (existe; antes
 * `GET /inmuebles/:id`). Copia del detalle que arma
 * `inmuebleService.getById` (`apps/api/src/services/inmueble.service.ts`).
 * NOTA: todavía no la usa ninguna pantalla (el listado ya trae lo que
 * muestra la tarjeta); queda para el detalle de la publicación.
 */
export interface InmuebleDetalleResponse {
  id: number
  tipo: CatalogoRef
  direccion: string
  numero: number
  piso?: string | null
  ciudad: string
  barrio: string
  provincia: string
  ambientes: number
  dormitorios: number
  banos: number
  m2_totales: number
  m2_cubiertos: number
  descripcion?: string | null
  /** `null` sin contrato (desde el 29/09); antes `-1`. */
  precio: number | null
  /** `null` sin contrato (desde el 29/09); antes `-1`. */
  expensas: number | null
  indice_ajuste: CatalogoRef | null
  fecha_disponible?: string | null
  tags: CatalogoRef[]
  servicio: { id: number; nombre: string; descripcion?: string | null } | null
  fotos: Array<{ id: number; url: string; es_principal: boolean; orden: number | null }>
}

/**
 * Cuerpo de `POST /api/v1/registrar-usuario` (existe). Las claves con ñ
 * (`contraseña`) son las que espera el back, tal cual.
 * NOTA: no lleva rol. El back registra a todos como locatario (regla del
 * equipo, 27/09/2026); el PR #2, que aceptaba `rol`, se cerró sin mergear.
 */
export interface RegistrarUsuarioRequest {
  nombre: string
  apellido: string
  email: string
  contraseña: string
  confirmar_contraseña: string
  telefono: string
  numero_documento: string
  /** Formato ISO `YYYY-MM-DD`. */
  fecha_nacimiento: string
  acepta_terminos: boolean
}
