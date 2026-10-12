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
import type { EstadoAlquiler } from '@rentar/shared-types'

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
 * NOTA: desde ce677a4 (29/09) el back respeta todos (probado el 06/10), pero
 * hoy el front manda solo `page` y `limit`: `/buscar` todavía filtra en el
 * cliente (ver el TODO(backend) de `propiedades.service.ts#buscarPropiedades`).
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

// ─── Solicitudes (US-35 a US-38) · PROPUESTOS ───────────────────────────
// NOTA: el back todavía no tiene el módulo de solicitudes. Estos DTOs son la
// propuesta del front (ver `docs/api-endpoints.md`, "Solicitudes"): si el
// back los arma distinto, se cambian acá y en `adapters/solicitud.adapter.ts`,
// nunca en las pantallas.

/** Estado de una solicitud, como lo guardaría la tabla (propuesto). */
export type EstadoSolicitudDto = 'pendiente' | 'aceptada' | 'rechazada' | 'cancelada'

/**
 * Cuerpo de `POST /api/v1/solicitudes` (no existe — propuesto). El
 * postulante sale del token.
 */
export interface CrearSolicitudRequest {
  id_inmueble: number
  /** Opcional, hasta 600 caracteres (US-35 actualizada). */
  mensaje?: string | null
  /** E.164: "+" + código de país + número, de 10 a 15 dígitos (US-35). */
  telefono: string
  email: string
  ocupacion: 'sin_informar' | 'relacion_dependencia' | 'monotributista' | 'autonoma' | 'estudiante' | 'jubilada'
  /** Entero ≥ 0; 0 = no informa (HANDOFF §7). */
  ingresos: number
  /** Mínimo 1 (US-35). */
  convivientes: number
  mascotas: boolean
  /** Hasta 300 caracteres; `null` si no tiene mascotas. */
  detalle_mascotas: string | null
  /** Al menos una de las que exige el inmueble, si exige alguna. */
  garantias: ('propietaria' | 'caucion' | 'otra')[]
  /** Siempre `true` (US-35: aceptación obligatoria). */
  acepta_condiciones: true
}

/**
 * Una solicitud, como la devolverían `POST /solicitudes`,
 * `GET /solicitudes/mias`, `GET /solicitudes/recibidas` y los `PATCH` de
 * cambio de estado (no existen — propuesto).
 */
export interface SolicitudResponse {
  id: number
  estado: EstadoSolicitudDto
  mensaje: string | null
  /** Fecha y hora ISO de envío. */
  fecha_creacion: string
  /**
   * Fecha y hora ISO en que dejó de estar pendiente (aceptada, rechazada o
   * cancelada); `null` mientras está pendiente.
   * TODO(backend): sumar la columna y devolverla (Mis solicitudes y
   * Solicitudes recibidas muestran "Aceptada el 14/09").
   */
  fecha_respuesta: string | null
  inmueble: {
    id: number
    direccion: string
    numero: number
    piso?: string | null
    barrio: string
    /** URL de la foto principal; `null` si no tiene fotos. */
    foto_principal: string | null
  }
  postulante: {
    id: number
    nombre: string
    apellido?: string | null
    /**
     * Datos de contacto y DNI (US-35 actualizada). Solo en `/recibidas`, y
     * solo para el dueño del inmueble: `/mias` no los manda.
     * TODO(db): la tabla `usuario` no tiene DNI (HANDOFF §10).
     */
    dni?: string | null
    telefono?: string | null
    email?: string | null
  }
  /**
   * Legajo de la solicitud (US-35 actualizada). Solo en `/recibidas`; `null`
   * si la solicitud es anterior y no lo tiene.
   */
  legajo?: {
    ocupacion: 'sin_informar' | 'relacion_dependencia' | 'monotributista' | 'autonoma' | 'estudiante' | 'jubilada'
    /** Entero; 0 = no informa. */
    ingresos: number
    convivientes: number
    mascotas: boolean
    detalle_mascotas: string | null
    garantias: ('propietaria' | 'caucion' | 'otra')[]
  } | null
}

// ─── Detalle de la propiedad del locador (US-03, US-04) · PROPUESTO ─────
// NOTA: `GET /mis-alquileres/:id` no existe. Es la propuesta del front (ver
// `docs/api-endpoints.md`, "Detalle de mi propiedad"): queda en la familia
// de rutas que ya filtra por dueño y no se confunde con el detalle público.

/**
 * Un número que una columna `numeric` de Postgres puede mandar como texto
 * ("360000.00"). Lo normaliza el adaptador.
 */
type NumericDto = number | string

/**
 * `GET /api/v1/mis-alquileres/:id` (no existe — propuesto): una propiedad
 * del locador del token, con todo lo que cargó el alta. 404 si no es suya.
 * Los nombres son los mismos que el cuerpo de `POST /inmuebles`
 * (`CreateInmuebleCompletoPayload`), así el detalle y el `PUT` ampliado
 * hablan el mismo idioma.
 */
export interface MisAlquileresDetalleResponse {
  id_inmueble: number
  tipo: number
  descripcion: string | null
  provincia: string
  ciudad: string
  barrio: string
  /** Calle (dirección EXACTA: la ve solo el dueño). */
  direccion: string
  numero: number
  piso: string | null
  m2_totales: number
  m2_cubiertos: number
  ambientes: number
  dormitorios: number
  banos: number
  antiguedad: number | null
  precio_publicado: NumericDto
  estado_alquiler: EstadoAlquiler
  fecha_disponible: string | null
  /** Fecha ISO de alta de la publicación. */
  fecha_publicacion: string | null
  /** Ids de `tags_inmueble`. */
  tags: number[]
  /** Fotos en orden, con la principal marcada. */
  fotos: { url: string; es_principal: boolean; orden: number }[]
  /** Las condiciones que cargó el alta (fila de `contrato` + medios de pago). */
  condiciones_contrato: {
    monto_alquiler: NumericDto
    expensas: NumericDto
    indice_aumento: number | null
    frecuencia_ajuste: string | null
    duracion_meses: number | null
    deposito: NumericDto | null
    interes_por_dia: NumericDto | null
    dias_gracia: number | null
    medios_pago: number[]
  }
  /** El contrato VIGENTE (estado "vigente"), o `null`. */
  contrato_vigente: {
    id: number | string
    /**
     * Nombre y apellido del locatario; `null` si el contrato no tiene
     * locatario cargado (pasa en los datos de prueba).
     */
    locatario: string | null
    /**
     * Fecha ISO de fin. NOTA: el puente desde `GET /mis-alquileres`
     * (`propiedad.adapter.ts#misAlquileresItemToDetalleResponse`) la manda
     * en `null` porque esa ruta no la devuelve.
     */
    fecha_fin: string | null
    proximo_ajuste: string | null
    monto_actual: NumericDto | null
  } | null
}
