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
 * (`apps/api/src/controllers/usuario.controller.ts`). Desde el Sprint 3 trae
 * también los datos personales (US-20); la sesión usa solo id, nombre,
 * apellido, email y roles, y el perfil usa todo (ver `PerfilResponse`).
 */
export interface UsuarioMeResponse {
  id: number
  nombre: string
  apellido?: string | null
  email: string
  /** 7 u 8 dígitos (la columna es única). */
  numero_documento?: string | null
  /**
   * Solo dígitos, sin "+" (el back valida `^[1-9]\d{9,14}$`). Los usuarios
   * del seed tienen 10 dígitos SIN código de país ("3511112233").
   */
  telefono?: string | null
  /** `YYYY-MM-DD`. */
  fecha_nacimiento?: string | null
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

// ─── Perfil (US-20, US-21) ──────────────────────────────────────────────
// NOTA: `GET` y `PATCH /usuarios/me` existen desde el Sprint 3 (develop,
// 917e8ff); el bloqueo de identidad y el correo, desde el 06/11 (8d2a46c).
// El legajo salió de US-20 y US-21 ese mismo día: no hay legajo del perfil.

/**
 * Contrato vigente o pendiente de firma que bloquea nombre, apellido y DNI
 * (US-21). Lo manda el back desde el 06/11 (8d2a46c), en `GET` y `PATCH
 * /usuarios/me`. `codigo` puede venir `null` (contrato sin código asignado).
 */
export interface BloqueoIdentidadDto {
  codigo: string | null
  estado: 'vigente' | 'pendiente_firma'
}

/**
 * Respuesta de `GET /api/v1/usuarios/me` y de `PATCH /api/v1/usuarios/me`
 * (existen) tal como la usa el perfil. Solo el usuario del token: no hay
 * forma de pedir el perfil de otro (US-20).
 */
export interface PerfilResponse extends UsuarioMeResponse {
  /** `null` = puede cambiar nombre, apellido y DNI. */
  bloqueo_identidad: BloqueoIdentidadDto | null
}

/**
 * Cuerpo de `PATCH /api/v1/usuarios/me` (existe). Solo los campos que
 * cambian: un campo de más, un body vacío o un valor vacío es un 400 (no se
 * puede borrar un dato mandando `""` ni `null`).
 */
export interface ActualizarPerfilRequest {
  nombre?: string
  apellido?: string
  numero_documento?: string
  /**
   * Correo nuevo (desde el 06/11, 8d2a46c). El back lo aplica en el momento,
   * en `usuario.email` y en el login de Supabase Auth, sin enlace de
   * confirmación. Lo guarda en minúsculas; tiene que ser único (409
   * `EMAIL_DUPLICADO`).
   */
  email?: string
  /** Sin el "+" ni separadores, 10 a 15 dígitos (`^[1-9]\d{9,14}$`). */
  telefono?: string
  /** `YYYY-MM-DD`, mayor de 18 años. */
  fecha_nacimiento?: string
}

/**
 * Código de los 409 de `PATCH /usuarios/me`, en el sobre
 * (`{ success: false, error, codigo }`, desde el 06/11, 8d2a46c). Lo lee
 * `apiClient` y lo guarda en `ServiceError.apiCode`; el adaptador decide
 * solo por él (`perfil.adapter.ts`).
 */
export type CodigoErrorPerfil = 'DNI_DUPLICADO' | 'EMAIL_DUPLICADO' | 'IDENTIDAD_BLOQUEADA_POR_CONTRATO'

// ─── Contratos (US-05) · PROPUESTA DEL SPRINT 3 ─────────────────────────
// NOTA: el back ya implementó sus rutas con otra forma (05/11): estos DTO son
// la propuesta del Sprint 3 y se reemplazan al conectar (Tandas 1 y 2 del
// Sprint 4). Estado real y nombres front → back en `docs/api-endpoints.md`
// ("Estado real de los endpoints"). Contrato
// completo en `docs/api-endpoints.md` ("Contratos") y `HANDOFF-BACKEND.md`
// §7 (US-05). Códigos de garantía igual que las solicitudes; medios de pago
// con los ids de `medio_pago`, igual que `/mis-alquileres`.

/** Estado del contrato. `estado_contrato` ya tiene borrador y pendiente de firma; `rescindido` no existe en la base. */
export type EstadoContratoDto = 'borrador' | 'pendiente_firma' | 'vigente' | 'finalizado' | 'rescindido'

/** Índice del contrato (propuesto). `sin_ajuste` en lugar de `indice_aumento` en `NULL`. */
export type IndiceContratoDto = 'sin_ajuste' | 'ICL' | 'IPC' | 'CAC'

/** Periodicidad del ajuste (propuesto; hoy `frecuencia_ajuste` es texto libre). */
export type PeriodicidadDto = 'trimestral' | 'semestral' | 'anual'

/** La dirección del inmueble, como la manda `/solicitudes`. */
/** El contrato en PDF. `url` es firmada y vence a los 5 minutos. Copia de `ContratoPdfResponse` del back. */
export interface ContratoPdfDto {
  nombre: string
  tamano_bytes: number
  subido_en: string
  url: string
}

/** Un firmante, como lo manda el back (US-42, US-43). Copia de `FirmanteDetalleResponse`. */
export interface FirmanteApiDto {
  /**
   * Los garantes firman (decisión del PO del 11/11). NOTA: el firmante garante
   * no trae el id del garante: se empareja por posición con `garantes[]`.
   */
  rol: 'locador' | 'locatario' | 'garante'
  nombre: string
  apellido: string
  /**
   * `sin_registro`: contrato anterior a RentAR, no se inventa si firmó.
   * `rechazado` solo en datos viejos: rechazar ahora vuelve el contrato a borrador.
   */
  estado: 'pendiente' | 'firmado' | 'rechazado' | 'sin_registro'
  fecha_firma: string | null
  fecha_rechazo: string | null
  motivo_rechazo: string | null
}

/** Las firmas de un contrato (US-42, US-43). Copia de `ContratoDetalleResponse['firmas']` del back. */
export interface FirmasApiDto {
  registradas: boolean
  faltan: number | null
  firmado_por_todos_el: string | null
  firmantes: FirmanteApiDto[]
}

/** Una fila de `GET /inmuebles/:id/contratos` (existe, US-43). Copia de `ContratoResumenResponse` del back. */
export interface ContratoPropiedadResponse {
  id: number
  codigo: string | null
  estado: 'borrador' | 'pendiente_firma' | 'vigente' | 'finalizado'
  locatario: { nombre: string; apellido: string } | null
  monto_actual: number | null
  fecha_inicio_contrato: string | null
  fecha_fin_contrato: string | null
  indice: IndiceContratoDto
  proximo_ajuste: string | null
  id_solicitud: number | null
  /** `null` en un borrador y en un finalizado. */
  firmas: FirmasApiDto | null
  /** Solo en pendiente de firma y vigente con archivo. */
  pdf: ContratoPdfDto | null
}

/** Respuesta de `GET /inmuebles/:id/contratos` (existe, US-43). Copia de `ContratosInmuebleResponse` del back. */
export interface ContratosInmuebleResponse {
  contratos: ContratoPropiedadResponse[]
  solicitud_para_contrato: number | null
}

/** Una parte del contrato, como la manda el back. Copia de `ParteContratoResponse`. */
export interface ParteApiDto {
  id: number
  nombre: string
  apellido: string
  numero_documento: string
  email: string
  telefono: string | null
}

/** Un garante, como lo manda el back. Copia de `GaranteResponse`. */
export interface GaranteApiDto {
  id: number
  nombre: string
  apellido: string
  dni: string
  email: string
}

/**
 * `GET /contratos/:id` y respuesta de `PATCH /contratos/:id`, `PUT /contratos/:id/pdf` y
 * `POST /contratos/:id/reabrir` (existen, US-05, US-06). Copia de `ContratoBorradorResponse`.
 */
export interface ContratoBorradorApiResponse {
  id: number
  codigo: string | null
  estado: 'borrador' | 'pendiente_firma' | 'vigente' | 'finalizado'
  id_solicitud: number | null
  inmueble: { id: number; direccion: string; numero: number; piso: string | null; barrio: string; precio_publicado: number }
  locador: ParteApiDto | null
  locatario: ParteApiDto | null
  /** Nombres de `tipo_garantia` ("garantía propietaria"), no códigos. */
  garantias_ofrecidas: string[]
  garantes: GaranteApiDto[]
  condiciones: {
    fecha_inicio_contrato: string | null
    fecha_fin_contrato: string | null
    duracion_meses: number | null
    monto_alquiler: number | null
    deposito: number | null
    /** Plazo en días (1 a 28), no el día del mes. */
    dias_para_vencimiento: number | null
    /** Id de `tipo_indice`; `null` = "Sin ajuste". */
    indice_aumento: number | null
    frecuencia_ajuste: string | null
    medios_pago: number[]
    dias_gracia: number | null
    interes_por_dia: number | null
  }
  pdf: ContratoPdfDto | null
  /** De 1 a 4. */
  ultimo_paso: number | null
  fecha_inicio_vencida: boolean
}

/** Respuesta de `POST /contratos` (existe): la fila creada. Solo se usa `id`. */
export interface ContratoCreadoResponse {
  id: number
}

/** Cuerpo de `PATCH /contratos/:id` (existe). Solo viaja lo que cambió. Copia de `GuardarBorradorRequest`. */
export interface GuardarBorradorRequest {
  /** De 1 a 4. */
  paso?: number
  condiciones?: {
    fecha_inicio_contrato?: string | null
    duracion_meses?: number | null
    monto_alquiler?: number | null
    deposito?: number | null
    dias_para_vencimiento?: number | null
    /** `null` = "Sin ajuste". */
    indice_aumento?: number | null
    frecuencia_ajuste?: PeriodicidadDto | null
  }
  garantes?: { nombre: string; apellido: string; dni: string; email: string }[]
}

/** Respuesta de `POST /contratos/:id/pdf/url-subida` (existe). Copia de `UrlSubidaPdfResponse`. */
export interface UrlSubidaPdfResponse {
  path: string
  token: string
  url_firmada: string
  tamano_maximo_bytes: number
}

/** Cuerpo de `PUT /contratos/:id/pdf` (existe). Copia de `RegistrarPdfRequest`. */
export interface RegistrarPdfRequest {
  path: string
  nombre: string
}

/** Respuesta de `GET /contratos/:id/detalle` (existe, US-42). Copia de `ContratoDetalleResponse` del back. */
export interface ContratoDetalleApiResponse {
  id: number
  codigo: string | null
  estado: 'pendiente_firma' | 'vigente' | 'finalizado'
  id_solicitud: number | null
  inmueble: { id: number; direccion: string; numero: number; piso: string | null; barrio: string; ciudad: string | null }
  locador: ParteApiDto | null
  locatario: ParteApiDto | null
  garantes: { id: number; nombre: string; apellido: string; dni: string; email: string }[]
  condiciones: {
    fecha_inicio_contrato: string | null
    fecha_fin_contrato: string | null
    duracion_meses: number | null
    monto_inicial: number | null
    monto_actual: number | null
    deposito: number | null
    /** Plazo en días, no el día del mes. TODO(backend): US-08 lo usa como día del mes (issue #27, punto 4). */
    dias_para_vencimiento: number | null
    /** `null` = "Sin ajuste". */
    indice: { id: number; descripcion: string } | null
    frecuencia_ajuste: string | null
    medios_pago: { id: number; nombre: string }[]
    dias_gracia: number | null
    interes_por_dia: number | null
  }
  /** NOTA: el front no lo usa: las fechas salen de `calendarioAjustes` y el monto es siempre "a definir" (decisión del PO). */
  calendario_ajustes: { fecha: string; tipo: 'inicio' | 'ajuste'; monto: number | null }[] | null
  firmas: FirmasApiDto
  pdf: ContratoPdfDto | null
  acciones: { modificar: boolean; firmar: boolean; descargar_pdf: boolean }
}

/** Cuerpo de `POST /contratos/:id/enviar` (US-05, paso 4): la casilla de la Revisión. */
export interface EnviarContratoRequest {
  confirma_revision: true
}

/** Respuesta de `POST /contratos/:id/enviar`. El código lo genera el back. */
export interface ContratoEnviadoResponse {
  id: number
  codigo: string
  estado: 'pendiente_firma'
}

/**
 * Códigos de negocio de contratos (en el `codigo` del sobre, ver `CodigoErrorPerfil`).
 * Los de US-07 (firma con DocuSign, `apps/api/src/services/contrato-firma.service.ts`):
 * - 409 `CONTRATO_NO_PENDIENTE` (firmar o rechazar un contrato que no está pendiente
 *   de firma), `YA_FIRMO` (firmar dos veces, o rechazar después de firmar) y
 *   `SOBRE_NO_DISPONIBLE` (el sobre de DocuSign no está listo).
 * - 400 `FALTA_ACEPTAR_CONDICIONES`, `MOTIVO_MUY_LARGO` y `MOTIVO_INVALIDO`.
 * Los de US-05 al enviar (`contrato-envio.validacion.ts`): 400 `FALTA_CONFIRMAR_REVISION`,
 * `FALTA_PDF`, `FALTAN_CONDICIONES`, `FALTAN_PARTES`, `FECHA_INICIO_VENCIDA` y 409
 * `CONTRATO_NO_BORRADOR`.
 */
export type CodigoErrorContrato =
  | 'SOLICITUD_NO_ACEPTADA'
  | 'SOLICITUD_CON_CONTRATO'
  | 'PROPIEDAD_CON_CONTRATO'
  | 'PROPIEDAD_CON_BORRADOR'
  | 'PROPIEDAD_SIN_OFERTA'
  | 'CONTRATO_DUPLICADO'
  | 'CONTRATO_BORRADOR'
  | 'CONTRATO_VIGENTE'
  | 'CONTRATO_FINALIZADO'
  | 'CONTRATO_FIRMADO_POR_LOCATARIO'
  | 'CONTRATO_YA_EN_BORRADOR'
  | 'CONTRATO_NO_EDITABLE'
  | 'CONTRATO_NO_BORRADOR'
  | 'CONTRATO_NO_PENDIENTE'
  | 'YA_FIRMO'
  | 'SOBRE_NO_DISPONIBLE'

// ─── Firma de contratos (US-07) · EXISTE ────────────────────────────────
// Firma embebida en DocuSign (develop, 10/11). Copia de `apps/api/src/dtos/contrato.dto.ts`
// ("US-07: firma con DocuSign"). Contrato en `docs/api-endpoints.md`, "Firma de contratos".

/** Cuerpo de `POST /contratos/:id/firmar` (y de `POST /firma-garante/:token/firmar`). */
export interface FirmarContratoRequest {
  /** La casilla "Leí el contrato completo y acepto sus condiciones y cláusulas". Siempre `true`. */
  acepta_condiciones: true
}

/** Respuesta de las rutas de firma: la URL de DocuSign. Dura pocos minutos y se usa una sola vez. */
export interface IniciarFirmaResponse {
  url: string
}

/** Cuerpo de `POST /contratos/:id/rechazar`. */
export interface RechazarFirmaRequest {
  /** Opcional, hasta 300 caracteres; `null` sin motivo. */
  motivo: string | null
}

/** Respuesta de `POST /contratos/:id/rechazar`: el contrato volvió a borrador (no trae el detalle). */
export interface RechazarContratoResponse {
  id: number
  estado: 'borrador'
}

// ─── Alquileres del locatario (US-27) · EXISTE ──────────────────────────
// `GET /alquileres-locatario` y `GET /alquileres-locatario/:idContrato`
// (develop, 066c032, 26/10). Copia de `apps/api/src/dtos/alquiler-locatario.dto.ts`:
// si el back cambia algo, se actualiza acá y en `adapters/contrato.adapter.ts`.

/** Estado del contrato visto por el locatario. El back no manda borradores ni rescindidos. */
export type EstadoAlquilerLocatarioDto = 'pendiente_firma' | 'vigente' | 'finalizado'

/**
 * Estado de la firma de una parte. `desconocido`: relaciones cargadas antes
 * de la migración de US-27, sin registro de si hubo firma.
 */
export type EstadoFirmaLocatarioDto = 'pendiente' | 'firmado' | 'rechazado' | 'desconocido'

/** Query de `GET /alquileres-locatario`. Sin filtro, los tres estados. */
export interface AlquileresLocatarioQuery {
  estado?: EstadoAlquilerLocatarioDto
}

/** Una parte en las firmas del detalle (sin nombre: el del locador sale de `locador`). */
export interface FirmaAlquilerDto {
  tipo: 'locador' | 'locatario' | 'garante'
  estado: EstadoFirmaLocatarioDto
  /** Fecha y hora ISO en que dio conformidad al PDF (paso previo a firmar, US-07). */
  fecha_conformidad: string | null
  fecha_firma: string | null
  fecha_rechazo: string | null
  motivo_rechazo: string | null
}

/** Una fila de `GET /alquileres-locatario` (ya ordenada: pendiente → vigente → finalizado). */
export interface AlquilerLocatarioItemResponse {
  id_contrato: number
  /** Hoy es `String(id_contrato)`, no `CT-AAAA-NNNN`. */
  codigo: string
  estado: EstadoAlquilerLocatarioDto
  inmueble: {
    id: number
    direccion: string
    numero: number
    piso: string | null
    barrio: string
    ciudad: string
    /** URL pública del bucket de fotos; `null` si no tiene. */
    foto_principal: string | null
  }
  locador: {
    id: number
    nombre: string
    apellido: string | null
    email: string
    /** Solo dígitos, como lo guarda `usuario.telefono` (con o sin código de país). */
    telefono: string | null
  }
  monto_actual: number
  expensas: number
  fecha_inicio_contrato: string | null
  fecha_fin_contrato: string | null
  deposito: number | null
  /** Descripción de `tipo_indice` ("ICL (Índice de Contratos de Locación)"); `null` sin índice. */
  indice_ajuste: string | null
  /** Texto libre de `contrato.frecuencia_ajuste` ("Semestral", "Anual"…). */
  frecuencia_ajuste: string | null
  fecha_ultimo_ajuste: string | null
  fecha_proximo_ajuste: string | null
}

/** `GET /alquileres-locatario/:idContrato`: la fila más lo de la ficha. Sin cláusulas. */
export interface AlquilerLocatarioDetalleResponse extends AlquilerLocatarioItemResponse {
  /** Plazo en días desde que el monto está disponible (no un día fijo del mes). */
  dias_para_vencimiento: number | null
  fecha_proximo_vencimiento_pago: string | null
  /** URL firmada y temporal del PDF (bucket privado `contratos-pdf`); `null` si no hay PDF. */
  pdf_url: string | null
  /** Nombres de `medio_pago` ("Transferencia bancaria", "Efectivo"…). */
  medios_pago: string[]
  garantes: { nombre: string; apellido: string | null; email: string; telefono: string | null }[]
  /**
   * Locador, locatario y garantes. NOTA: las firmas de tipo `garante` no
   * traen el nombre: se emparejan por posición con `garantes[]` (mismo orden).
   */
  firmas: FirmaAlquilerDto[]
  /** `true` si el contrato está pendiente de firma, tiene su sobre de DocuSign y el locatario no firmó (US-07). */
  puede_firmar: boolean
  monto_proximo_ajuste: 'a definir' | null
}

// ─── Cobros (US-08, US-09 y US-10) ────────────────────────────────────

/** Estado de un período. */
export type EstadoPeriodoDto = 'pendiente' | 'vencido' | 'pagado'

/** Medio de un cobro manual. */
export type MedioCobroDto = 'transferencia' | 'efectivo' | 'cheque' | 'mercadopago_externo' | 'otro'

/** Propiedad en las consultas de cobros. */
export interface PropiedadCobroResponse {
  id: number
  direccion: string
  numero: number
  piso: string | null
  barrio: string
  ciudad: string
}

/** Persona en las consultas de cobros. */
export interface PersonaCobroResponse {
  id: number
  nombre: string
  apellido: string | null
  email?: string
  telefono?: string | null
}

/** Línea de cargos. NOTA: `dias_mora`, `dias_interes` y `diasMora` son lo mismo según el endpoint. */
export interface CargoCobroResponse {
  concepto: 'alquiler' | 'intereses_mora'
  monto: number
  dias_mora?: number
  dias_interes?: number
  diasMora?: number
}

/** Fila de `GET /cobros-locador`: períodos que se pueden cobrar. */
export interface PeriodoCobroItemResponse {
  id_periodo: number
  id_contrato: number
  periodo: string
  inmueble: { id: number; direccion: string; numero: number; piso: string | null; barrio: string }
  locatario: { id: number; nombre: string; apellido: string | null } | null
  estado: EstadoPeriodoDto
  fecha_inicio: string
  fecha_fin: string
  fecha_vencimiento: string
  monto_base_alquiler: number
  intereses_mora: number
  monto_exigible: number
  expensas_snapshot: number
  saldo: number
}

/** `GET /cobros-locador`. */
export interface PeriodosCobroResponse {
  items: PeriodoCobroItemResponse[]
  total: number
  page: number
  limit: number
}

/** Fila de `GET /cobros-locador/historial`. */
export interface PeriodoCobroResumenResponse {
  id_periodo: number
  id_contrato: number
  codigo_contrato: string | null
  periodo: string
  estado: EstadoPeriodoDto
  fecha_inicio: string
  fecha_fin: string
  fecha_vencimiento: string
  propiedad: PropiedadCobroResponse
  locatario: PersonaCobroResponse | null
  monto_base_alquiler: number
  intereses_mora: number
  dias_atraso: number
  dias_interes: number
  monto_exigible: number
  total_cobrado: number
  saldo: number
  cantidad_cobros: number
  tiene_adjunto: boolean
  comprobante_url: string | null
}

/** `GET /cobros-locador/historial`. */
export interface HistorialCobrosResponse {
  items: PeriodoCobroResumenResponse[]
  total: number
  page: number
  limit: number
}

/** Cobro dentro de `GET /cobros/:id`. */
export interface CobroRegistradoResponse {
  id_cobro: number
  numero_comprobante: string
  fecha_cobro: string
  monto: number
  medio: MedioCobroDto
  nota: string | null
  created_at: string
  usuario_registro: { nombre: string; apellido: string | null }
  tiene_adjunto: boolean
  /** URL firmada del adjunto: vence a los 60 segundos. */
  adjunto_url: string | null
  comprobante_url: string
}

/** Evento del historial del período. */
export interface EventoPeriodoResponse {
  tipo: 'periodo_generado' | 'cobro_registrado' | 'periodo_pagado'
  fecha_hora: string
  usuario: { nombre: string; apellido: string | null } | null
}

/** `GET /cobros/:id`. */
export interface DetalleCobroResponse {
  id_periodo: number
  id_contrato: number
  propiedad: PropiedadCobroResponse
  locador: PersonaCobroResponse
  locatario: PersonaCobroResponse
  contrato: { codigo: string | null; fecha_inicio: string | null; fecha_fin: string | null }
  periodo: {
    periodo: string
    estado: EstadoPeriodoDto
    fecha_inicio: string
    fecha_fin: string
    fecha_vencimiento: string
  }
  cargos: CargoCobroResponse[]
  total_exigible: number
  total_cobrado: number
  saldo: number
  cobros: CobroRegistradoResponse[]
  historial: EventoPeriodoResponse[]
}

/** `POST /cobros-locador` (multipart). */
export interface RegistrarCobroResponse {
  cobro_id: number
  periodo_id: number
  monto: number
  intereses: number
  dias_interes: number
  numero_comprobante: string
  estado_periodo: 'pagado'
}

/** Persona del comprobante. */
export interface PersonaComprobanteResponse {
  id: number
  nombre: string
  apellido: string | null
  numero_documento: string | null
  email: string
  telefono: string | null
}

/** `GET /cobros/:id/comprobante`, con el id del cobro. */
export interface ComprobantePagoResponse {
  id_cobro: number
  numero_comprobante: string
  fecha_emision: string
  estado: 'pagado'
  locatario: PersonaComprobanteResponse
  locador: PersonaComprobanteResponse
  propiedad: PropiedadCobroResponse
  contrato: { id: number; codigo: string | null; fecha_inicio: string | null; fecha_fin: string | null }
  periodo: { id: number; periodo: string; fecha_inicio: string; fecha_fin: string; fecha_vencimiento: string }
  cargos: CargoCobroResponse[]
  total_pagado: number
  total_en_letras: string
  medio: MedioCobroDto
  fecha_cobro: string
  nota: string | null
}

/** Fila de `GET /cobros-locatario`: un pago, con los datos de su período. */
export interface PagoLocatarioResponse extends PeriodoCobroResumenResponse {
  fecha_pago: string
  monto_pagado: number
  medio: MedioCobroDto
  recargo_pagado: number
  pagos_a_termino: boolean
}

/**
 * `GET /cobros-locatario`.
 * NOTA: `proximo_periodo` es uno solo, aunque haya varios contratos, y `anio`
 * también lo filtra: se pide sin `anio` (issue #27, punto 17).
 */
export interface PagosLocatarioResponse {
  proximo_periodo: PeriodoCobroResumenResponse | null
  items: PagoLocatarioResponse[]
  total: number
  page: number
  limit: number
}
