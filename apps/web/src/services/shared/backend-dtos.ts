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
import type { CreateFotoPayload, EstadoAlquiler } from '@rentar/shared-types'

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

// ─── Solicitudes (US-35 a US-38) ────────────────────────────────────────
// NOTA: copias de `apps/api/src/dtos/solicitud.dto.ts` (en `develop` desde el
// 12/10). Si el back cambia la forma, se cambia acá y en
// `adapters/solicitud.adapter.ts`, nunca en las pantallas.

/** Ocupación del postulante, con los códigos que usa el back (`situacion_ocupacional`). */
export type OcupacionDto = 'sin_informar' | 'relacion_dependencia' | 'monotributista' | 'autonoma' | 'estudiante' | 'jubilada'

/** Garantía ofrecida o exigida, con los códigos que usa el back (`tipo_garantia`). */
export type GarantiaDto = 'propietaria' | 'caucion' | 'otra'

/**
 * Cuerpo de `POST /api/v1/solicitudes` (existe): `CrearSolicitudRequest` del
 * back. El postulante sale del token.
 */
export interface CrearSolicitudRequest {
  id_inmueble: number
  /** Opcional, hasta 600 caracteres (US-35 actualizada). */
  mensaje?: string | null
  /**
   * E.164: "+" + código de país + número, de 10 a 15 dígitos (US-35). El back
   * lo guarda sin el "+" y lo devuelve así (ver `SolicitudResponse`).
   */
  telefono: string
  email: string
  ocupacion: OcupacionDto
  /**
   * Entero mayor que 0, o `null` si no lo informa. NOTA: el back convierte un
   * 0 en `null` por compatibilidad; el adaptador ya manda `null`.
   */
  ingresos: number | null
  /** Mínimo 1 (US-35). */
  convivientes: number
  mascotas: boolean
  /** Hasta 300 caracteres; `null` si no tiene mascotas. */
  detalle_mascotas: string | null
  /** Al menos una de las que exige el inmueble, si exige alguna. */
  garantias: GarantiaDto[]
  /** Siempre `true` desde el front (US-35: aceptación obligatoria). */
  acepta_condiciones: true
}

/**
 * Cuerpo de `PATCH /api/v1/solicitudes/:id/rechazar` (existe):
 * `RechazarSolicitudRequest` del back. Opcional: sin motivo, el `PATCH` va
 * sin cuerpo.
 */
export interface RechazarSolicitudRequest {
  /** Motivo del rechazo, ya sin espacios en los bordes; hasta 200 caracteres (US-37). */
  mensaje_rechazo: string
}

/**
 * Una solicitud, como la devuelven `POST /solicitudes`, `GET /solicitudes/mias`,
 * `GET /solicitudes/recibidas` y los `PATCH` de cambio de estado (existen):
 * `SolicitudResponse` del back, armada en `solicitudRepository.findByIdWithRelations`.
 */
export interface SolicitudResponse {
  id: number
  /**
   * `nombre` de la tabla `estado_solicitud`: hoy `pendiente`, `aceptada`,
   * `rechazada` o `cancelada`. El back lo tipa como texto libre, así que el
   * adaptador lo valida antes de usarlo.
   */
  estado: string
  mensaje: string | null
  /** Motivo del rechazo (US-37), hasta 200 caracteres; `null` (o sin el campo) si no tiene. */
  mensaje_rechazo?: string | null
  /** Fecha y hora ISO de envío. */
  fecha_creacion: string
  /**
   * Fecha y hora ISO en que dejó de estar pendiente (aceptada, rechazada o
   * cancelada); `null` mientras está pendiente.
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
     * DNI (`usuario.numero_documento`), teléfono y email de la solicitud.
     * NOTA: el back los manda SIEMPRE, también en `/mias` y en las respuestas
     * de los `PATCH` (brecha anotada en HANDOFF §7). El adaptador los descarta
     * salvo en el detalle del postulante.
     * NOTA: el teléfono llega solo con dígitos, sin el "+".
     */
    dni?: string | null
    telefono?: string | null
    email?: string | null
  }
  /**
   * Legajo de la solicitud (US-35 actualizada). El back lo manda siempre
   * (también en `/mias`); se deja `null` posible por las solicitudes viejas.
   */
  legajo: {
    ocupacion: OcupacionDto
    /** Entero mayor que 0, o `null` si no lo informó. */
    ingresos: number | null
    convivientes: number
    mascotas: boolean
    detalle_mascotas: string | null
    garantias: GarantiaDto[]
  } | null
}

/** Query de `GET /solicitudes/mias` y `GET /solicitudes/recibidas` (existen). */
export interface FiltrosSolicitudesQuery {
  estado?: 'pendiente' | 'aceptada' | 'rechazada' | 'cancelada'
  /** Id del inmueble (entero positivo; en el front, texto). */
  inmueble?: string
}

/**
 * Respuesta de `GET /api/v1/solicitudes/preparar?id_inmueble=` (existe):
 * `SolicitudPreparacionResponse` del back, la precarga del modal (US-35).
 * 403 si es su propia propiedad, 404 si no existe, 409 si ya no recibe solicitudes.
 */
export interface SolicitudPreparacionResponse {
  usuario: {
    id: number
    nombre: string
    apellido?: string | null
    dni?: string | null
    /** Solo dígitos, sin el "+" (como lo guarda la tabla `usuario`). */
    telefono?: string | null
    email: string
  }
  /** Catálogo de ocupaciones. NOTA: el front no lo usa; tiene sus etiquetas (`OCUPACION_LABEL`). */
  situaciones_ocupacionales: { id: number; codigo: OcupacionDto; nombre: string }[]
  /** Catálogo de garantías. NOTA: el front no lo usa; tiene sus etiquetas (`GARANTIA_LABEL`). */
  garantias: { id: number; codigo: GarantiaDto; nombre: string }[]
  /**
   * Ids (de `garantias`) que exige el inmueble.
   * TODO(db): el esquema no guarda las garantías exigidas: hoy llega siempre vacío.
   */
  garantias_exigidas: number[]
  /**
   * El legajo del usuario, para precargar la solicitud (US-21). NO EXISTE
   * todavía: propuesto en el Sprint 3, misma forma que `LegajoDto` del
   * perfil. `null` o ausente = sin legajo.
   * TODO(backend): sumarlo a `GET /solicitudes/preparar` (HANDOFF §7).
   */
  legajo?: LegajoDto | null
  /** NOTA: el front no los usa: arma los suyos con `valoresIniciales` (mismos valores por defecto). */
  valores_iniciales: {
    telefono: string
    email: string
    ocupacion: 'sin_informar'
    ingresos: null
    convivientes: number
    mascotas: boolean
    detalle_mascotas: null
    garantias: GarantiaDto[]
    acepto: boolean
  }
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
 * (`CreateInmuebleCompletoPayload`), así el detalle y el alta hablan el
 * mismo idioma.
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
  /**
   * Fotos en orden, con la principal marcada. El peso y el formato hacen
   * falta para reenviarlas en la edición (US-03, `PUT /inmuebles/:id`).
   */
  fotos: { url: string; es_principal: boolean; orden: number; peso_kb: number; formato: string }[]
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

/**
 * Cuerpo de `PUT /api/v1/inmuebles/:id` (US-03 Modificar mis propiedades).
 * Existe desde el 10/10 (`develop` b5acfa7): es el `UpdateInmuebleDTO` del back
 * y lo procesa la función SQL `actualizar_propiedad_completa`.
 *
 * - Actualización PARCIAL: la clave que no se manda conserva su valor. El
 *   front manda solo lo que cambió (`propiedad.adapter.ts#cambiosToUpdateInmueble`).
 * - `fotos` y `tags`, si se mandan, REEMPLAZAN la lista completa. `fotos`
 *   pide de 3 a 50, con URL, formato y peso mayor que 0; `tags: []` borra todos.
 * - No acepta `estado_alquiler` ni ningún dato del contrato (400).
 * - `servicios` existe en el back, pero el formulario no lo pide: no se manda.
 */
export interface UpdateInmueblePayload {
  tipo?: number
  descripcion?: string | null
  provincia?: string
  ciudad?: string
  barrio?: string
  direccion?: string
  numero?: number
  piso?: string | null
  m2_totales?: number
  m2_cubiertos?: number
  ambientes?: number
  dormitorios?: number
  banos?: number
  antiguedad?: number | null
  precio_publicado?: number
  fecha_disponible?: string | null
  fotos?: CreateFotoPayload[]
  tags?: number[]
}

// ─── Perfil y legajo (US-20, US-21) ─────────────────────────────────────
// NOTA: PROPUESTOS por el front (Sprint 3): el back todavía no tiene estas
// rutas. Contrato completo en `docs/api-endpoints.md` ("Perfil") y en
// `docs/HANDOFF-BACKEND.md` §7. Mismos códigos de ocupación y garantía que
// las solicitudes, así el legajo pasa del perfil a la solicitud sin traducir.

/** El legajo como lo guardaría el back (propuesto). */
export interface LegajoDto {
  ocupacion: OcupacionDto
  /** Entero mayor que 0, o `null` si no lo cargó (US-21). */
  ingresos: number | null
  garantias: GarantiaDto[]
}

/**
 * Respuesta de `GET /api/v1/usuarios/me/perfil` (no existe — propuesto).
 * Solo el usuario del token: no hay forma de pedir el perfil de otro (US-20).
 */
export interface PerfilResponse {
  id: number
  nombre: string
  apellido: string | null
  email: string
  numero_documento: string | null
  /** Solo dígitos, con código de país (igual que en `SolicitudResponse`). */
  telefono: string | null
  /** `YYYY-MM-DD`. */
  fecha_nacimiento: string | null
  /** Descripciones de la tabla `rol`, igual que `/usuarios/me`. */
  roles: string[]
  /**
   * El contrato vigente o pendiente de firma del que el usuario es parte
   * (locador o locatario), si hay uno: bloquea nombre, apellido y DNI (US-21).
   * Si hay varios, cualquiera (el front solo lo nombra).
   */
  contrato_bloqueante: { codigo: string; estado: 'vigente' | 'pendiente_firma' } | null
  /** `null` si nunca lo cargó. */
  legajo: LegajoDto | null
}

/**
 * Cuerpo de `PATCH /api/v1/usuarios/me` (no existe — propuesto). Solo los
 * campos que cambian. El correo NO va acá: lo cambia Supabase Auth.
 */
export interface ActualizarPerfilRequest {
  nombre?: string
  apellido?: string
  numero_documento?: string
  /** E.164 sin el "+" ni separadores, 10 a 15 dígitos. */
  telefono?: string | null
  fecha_nacimiento?: string | null
}

/** Cuerpo de `PATCH /api/v1/usuarios/me/legajo` (no existe — propuesto). Reemplaza el legajo entero. */
export type ActualizarLegajoRequest = LegajoDto

/**
 * Código de error de negocio que el front propone que el back mande en el
 * sobre (`{ success: false, error, codigo }`), para distinguir dos 409 de la
 * misma ruta sin leer el texto. Lo lee `apiClient` y lo guarda en
 * `ServiceError.apiCode`.
 */
export type CodigoErrorPerfil = 'DNI_DUPLICADO' | 'IDENTIDAD_BLOQUEADA_POR_CONTRATO'

// ─── Contratos (US-05) · PROPUESTO ──────────────────────────────────────
// NOTA: ninguna de estas rutas existe todavía (Sprint 3, tanda 2). Contrato
// completo en `docs/api-endpoints.md` ("Contratos") y `HANDOFF-BACKEND.md`
// §7 (US-05). Códigos de garantía igual que las solicitudes; medios de pago
// con los ids de `medio_pago`, igual que `/mis-alquileres`.

/** Estado del contrato (propuesto: hoy `estado_contrato` solo tiene disponible, vigente y finalizado). */
export type EstadoContratoDto = 'borrador' | 'pendiente_firma' | 'vigente' | 'finalizado' | 'rescindido'

/** Índice del contrato (propuesto). `sin_ajuste` en lugar de `indice_aumento` en `NULL`. */
export type IndiceContratoDto = 'sin_ajuste' | 'ICL' | 'IPC' | 'CAC'

/** Periodicidad del ajuste (propuesto; hoy `frecuencia_ajuste` es texto libre). */
export type PeriodicidadDto = 'trimestral' | 'semestral' | 'anual'

/** La dirección del inmueble, como la manda `/solicitudes`. */
export interface InmuebleContratoDto {
  id: number
  direccion: string
  numero: number
  piso: string | null
  barrio: string | null
}

/** Una fila de `GET /contratos` (no existe — propuesto). Sin DNI ni contacto. */
export interface ContratoResumenResponse {
  id: number
  /** `null` en los borradores. */
  codigo: string | null
  estado: EstadoContratoDto
  inmueble: InmuebleContratoDto
  locatario: { nombre: string; apellido: string | null }
  /**
   * Nombre del locador (propuesto, US-27): lo necesita Mis alquileres
   * (`GET /contratos?rol=locatario`). Sin contacto ni DNI en la fila.
   */
  locador?: { nombre: string; apellido: string | null } | null
  monto_actual: number | null
  fecha_inicio: string | null
  fecha_fin: string | null
  indice: IndiceContratoDto | null
  proximo_ajuste: string | null
  id_solicitud: number | null
}

/** Locador o locatario del contrato (salen de `usuario`; el front no los manda). */
export interface ParteContratoDto {
  id: number
  nombre: string
  apellido: string | null
  numero_documento: string | null
  email: string
  /** Solo dígitos, con código de país. */
  telefono: string | null
}

/** Un garante: dato del contrato, sin cuenta (decisión del PO: no firma en el Sprint 3). */
export interface GaranteDto {
  nombre_apellido: string
  numero_documento: string
  email: string
}

/** Las condiciones del contrato. En un borrador, cualquier campo puede venir en `null`. */
export interface CondicionesContratoDto {
  fecha_inicio: string | null
  duracion_meses: number | null
  monto_inicial: number | null
  deposito: number | null
  dia_vencimiento: number | null
  indice: IndiceContratoDto
  periodicidad: PeriodicidadDto | null
}

/** Una cláusula. `clave` es la de la plantilla del front (`objeto`, `precio`…) o `propia-<n>`. */
export interface ClausulaDto {
  clave: string
  tipo: 'fija' | 'editable' | 'propia'
  titulo: string
  texto: string
  editada: boolean
}

/**
 * `GET /contratos/:id` y `GET /contratos/preparar?id_solicitud=` (no existen
 * — propuestos). `/preparar` devuelve el contrato todavía sin guardar:
 * `id`, `codigo`, `condiciones` y `clausulas` vacíos (el front los completa
 * con sus valores por defecto y su plantilla).
 */
export interface ContratoResponse {
  id: number | null
  codigo: string | null
  estado: EstadoContratoDto
  id_solicitud: number
  /** Cuándo se aceptó la solicitud (`solicitud.fecha_respuesta`). */
  fecha_aceptacion_solicitud: string | null
  inmueble: InmuebleContratoDto & {
    /** URL de la foto principal (US-27, ficha del locatario; propuesto). `null` si no tiene. */
    foto_principal: string | null
    precio_publicado: number | null
    /** Índice de la publicación (`tipo_indice`): ICL o IPC; `null` si no tiene. */
    indice_publicacion: 'ICL' | 'IPC' | null
    medios_pago: number[]
    dias_gracia: number | null
    interes_por_dia: number | null
  }
  locador: ParteContratoDto
  locatario: ParteContratoDto
  garantias_ofrecidas: GarantiaDto[]
  garantes: GaranteDto[]
  condiciones: CondicionesContratoDto | null
  clausulas: ClausulaDto[]
  ultimo_paso: number
}

/** Cuerpo de `POST /contratos` y `PUT /contratos/:id` (no existen — propuestos). */
export interface ContratoRequest {
  id_solicitud: number
  garantes: GaranteDto[]
  condiciones: CondicionesContratoDto
  clausulas: ClausulaDto[]
  ultimo_paso: number
}

/** Respuesta de `POST /contratos/:id/enviar` (no existe — propuesto). El código lo genera el back. */
export interface ContratoEnviadoResponse {
  id: number
  codigo: string
  estado: 'pendiente_firma'
}

/**
 * Códigos de negocio de los 409 de contratos (en el `codigo` del sobre, ver `CodigoErrorPerfil`).
 * Los de US-07 (Sprint 3, tanda 3): `CONTRATO_NO_PENDIENTE` (firmar, rechazar,
 * cancelar o reenviar un contrato que no está pendiente de firma), `YA_FIRMO`,
 * `FIRMA_RECHAZADA` (firmar después de rechazar), `OTRA_PARTE_FIRMO` (cancelar
 * el envío) y `FIRMANTE_NO_PENDIENTE` (reenviar a quien ya firmó o rechazó).
 */
export type CodigoErrorContrato =
  | 'SOLICITUD_NO_ACEPTADA'
  | 'SOLICITUD_CON_CONTRATO'
  | 'PROPIEDAD_CON_CONTRATO'
  | 'CONTRATO_NO_EDITABLE'
  | 'CONTRATO_NO_PENDIENTE'
  | 'YA_FIRMO'
  | 'FIRMA_RECHAZADA'
  | 'OTRA_PARTE_FIRMO'
  | 'FIRMANTE_NO_PENDIENTE'

// ─── Firma de contratos (US-07) · PROPUESTO ─────────────────────────────
// NOTA: no existen (Sprint 3, tanda 3). Contrato en `docs/api-endpoints.md`
// ("Contratos", US-07). Firman el locador y el locatario (decisión del PO).

/** Rol de quien firma. */
export type RolFirmanteDto = 'locador' | 'locatario'

/** Una parte que firma, con el estado de su firma. La IP la guarda el back y NO viaja al front. */
export interface FirmanteDto {
  rol: RolFirmanteDto
  id_usuario: number
  nombre: string
  apellido: string | null
  estado: 'pendiente' | 'firmado' | 'rechazado'
  /** Fecha y hora ISO de la firma (la registra el back, con la IP). */
  fecha_firma: string | null
  fecha_rechazo: string | null
  motivo_rechazo: string | null
  /** Fecha y hora ISO de la última invitación (el envío o un reenvío): el front calcula desde cuándo se puede reenviar. */
  fecha_ultima_invitacion: string | null
}

/** Un evento del historial del contrato. */
export interface EventoContratoDto {
  id: number
  tipo: 'creado' | 'enviado' | 'firmado' | 'rechazado' | 'reenviado' | 'envio_cancelado' | 'vigente'
  /** Fecha y hora ISO. */
  fecha: string
  rol: RolFirmanteDto | null
  /** Nombre y apellido de quien firmó o rechazó, o a quien se le reenvió. */
  nombre: string | null
  motivo: string | null
}

/**
 * `GET /contratos/:id` con lo de US-07 (propuesto): el mismo `ContratoResponse`
 * más los firmantes y el historial, en una sola respuesta (el historial no
 * tiene otro uso que este detalle). También es la respuesta de firmar,
 * rechazar, cancelar el envío y reenviar.
 * Lo pueden pedir el locador y el locatario del contrato; un borrador, solo el locador.
 */
export interface ContratoDetalleResponse extends ContratoResponse {
  fecha_envio: string | null
  /** Fecha y hora de la última firma, cuando firmaron todas las partes. */
  fecha_firma_completa: string | null
  /** `false` en los contratos cargados antes de RentAR: sin firmas ni historial. */
  firmas_registradas: boolean
  fecha_fin: string | null
  firmantes: FirmanteDto[]
  /** Del más reciente al más viejo. */
  historial: EventoContratoDto[]
  /** Monto mensual actual, con los ajustes aplicados (US-27; propuesto). */
  monto_actual: number | null
}

/** Cuerpo de `POST /contratos/:id/rechazar` (propuesto). */
export interface RechazarFirmaRequest {
  /** Opcional, hasta 300 caracteres; `null` sin motivo. */
  motivo: string | null
}

/** Cuerpo de `POST /contratos/:id/reenviar` (propuesto). Hoy solo `locatario`: el locador es quien reenvía. */
export interface ReenviarInvitacionRequest {
  rol: RolFirmanteDto
}
