/**
 * shared/backend-dtos.ts — copias de DTOs del back que `@rentar/shared-types`
 * todavía no exporta.
 *
 * Qué es: la forma exacta de algunas respuestas y cuerpos de `apps/api` que
 * viven solo en `apps/api/src/dtos/index.ts`. El frontend no puede importar
 * de `apps/api`, así que se copian acá, campo por campo.
 * TODO(backend): mover estos DTOs a `@rentar/shared-types` y reemplazar esta
 * copia por un import.
 *
 * Quién lo usa: la rama real de los services y los adaptadores.
 */

/**
 * Respuesta de `GET /api/v1/inmuebles/disponibles/:id` (existe).
 * Copia de `InmuebleDetalleDTO` de `apps/api/src/dtos/index.ts`.
 */
export interface InmuebleDetalleResponse {
  id: number
  tipo_inmueble: string
  direccion: string
  numero: number
  piso?: string | null
  ciudad: string
  ambientes: number
  dormitorios: number
  banos: number
  m2: number
  descripcion?: string | null
  tag?: string | null
  servicio?: string | null
  id_locador: number
  created_at?: string
  publicacion?: {
    id: number
    titulo: string
    precio: number
    activa: boolean
    created_at?: string
  } | null
}

/**
 * Cuerpo de `POST /api/v1/registrar-usuario` (en curso en
 * `feature/registrar-usuario`). Copia de `CreateUsuarioPayload` de esa rama
 * (`packages/shared-types/src/index.ts`). Las claves con tilde y ñ
 * (`contraseña`) son las que espera el back, tal cual.
 *
 * TODO(backend): la rama registra a todos como locatario. Hay que aceptar el
 * rol elegido en el paso 1 (`rol`) en el body.
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
  /** Propuesto, todavía no existe en el back (ver el TODO(backend) de arriba). */
  rol: 'locador' | 'locatario'
}

/**
 * Respuesta de `POST /api/v1/registrar-usuario` en `feature/registrar-usuario`:
 * el `Usuario` creado, con los campos nuevos de esa rama.
 */
export interface RegistrarUsuarioResponse {
  id: number
  nombre: string
  apellido?: string | null
  email: string
  numero_documento: string
  telefono?: string | null
  fecha_nacimiento?: string | null
}

/**
 * Cuerpo de `POST /api/v1/inmuebles` (existe). Copia de `CreateInmuebleDTO`
 * de `apps/api/src/dtos/index.ts`.
 *
 * TODO(backend): faltan casi todos los campos de US-01 (ver
 * `propiedad.adapter.ts#propiedadNuevaToCrearInmueble`): provincia, barrio,
 * superficie cubierta, antigüedad, estado, disponibilidad, fotos, expensas,
 * índice, periodicidad, medios de pago, interés, días de gracia, depósito y
 * duración. `tags` y `servicios` son un solo id, no una lista. `id_locador`
 * viaja en el body: debería salir de la sesión.
 */
export interface CrearInmuebleRequest {
  tipo: number
  direccion: string
  numero: number
  piso?: string | null
  ciudad: string
  ambientes: number
  dormitorios: number
  banos: number
  m2: number
  descripcion?: string | null
  tags?: number | null
  id_locador: number
  servicios?: number | null
}

/**
 * Cuerpo de `POST /api/v1/publicaciones` (existe). Copia de
 * `CreatePublicacionDTO` de `apps/api/src/dtos/index.ts`.
 *
 * TODO(backend): hoy el back exige un contrato asociado para publicar (regla
 * de negocio de `publicacion.service.ts`), así que una propiedad nueva no se
 * puede publicar. En US-01 la publicación nace con el alta, sin contrato.
 */
export interface CrearPublicacionRequest {
  id_inmueble: number
  titulo: string
  precio: number
  activa?: boolean
}
