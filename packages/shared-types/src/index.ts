/**
 * Shared Types for RentAR (Alineado con US-01)
 */

export interface Rol {
  id: number;
  descripcion: string;
}

export interface Usuario {
  id: number;
  nombre: string;
  apellido?: string | null;
  email: string;
  numero_documento: string;
  telefono?: string | null;
  fecha_nacimiento?: string | null;
}

export interface CreateUsuarioPayload {
  nombre: string;
  apellido: string;
  email: string;
  contraseña: string;
  confirmar_contraseña: string;
  telefono: string;
  numero_documento: string;
  fecha_nacimiento: string;
  acepta_terminos: boolean;
}

export interface UsuarioXRol {
  id_usuario: number;
  id_rol: number;
}

export interface TipoInmueble {
  id: number;
  descripcion: string;
}

export interface TagInmueble {
  id: number;
  descripcion: string;
  estado?: boolean;
}

export interface Servicio {
  id: number;
  nombre: string;
  descripcion: string;
}

export interface TipoIndice {
  id: number;
  descripcion: string;
  valor?: number;
}

export interface EstadoContrato {
  id: number;
  descripcion: string;
  valor?: boolean;
}

export interface MedioPago {
  id: number;
  nombre: string;
  descripcion?: string;
}

export interface MedioPagoXContrato {
  id: number;
  id_contrato: number;
  id_medio_pago: number;
}

export type EstadoAlquiler = 'publicado' | 'pausado' | 'alquilado';

export interface Inmueble {
  id: number;
  id_locador: number;
  tipo: number;
  descripcion?: string | null;
  provincia: string;
  ciudad: string;
  barrio: string;
  direccion: string;
  numero: number;
  piso?: string | null;
  m2_totales: number;
  m2_cubiertos: number;
  ambientes: number;
  dormitorios: number;
  banos: number;
  antiguedad?: number | null;
  precio_publicado: number;
  estado_alquiler: EstadoAlquiler;
  fecha_disponible?: string | null;
  servicios?: number | null;
}

export interface FotoInmueble {
  id: number;
  id_inmueble: number;
  url: string;
  es_principal: boolean;
  peso_kb: number;
  formato: string;
  orden: number;
}

export interface InmuebleXTag {
  id: number;
  id_inmueble: number;
  id_tag: number;
}

export interface Contrato {
  id: number;
  id_inmueble: number;
  monto_alquiler: number;
  expensas: number;
  indice_aumento?: number | null;
  frecuencia_ajuste?: string | null;
  duracion_meses?: number | null;
  deposito?: number | null;
  interes_por_dia?: number | null;
  dias_gracia?: number | null;
  fecha_inicio_contrato?: string | null;
  fecha_fin_contrato?: string | null;
  estado?: number | null;
}

/**
 * Payload completo para el registro atómico de propiedad (US-01)
 */
export interface CreateFotoPayload {
  url: string;
  peso_kb: number;
  formato: string;
  es_principal?: boolean;
}

export interface CreateContratoCondicionesPayload {
  monto_alquiler: number;
  expensas: number;
  indice_aumento?: number | null;
  frecuencia_ajuste?: string | null;
  duracion_meses?: number | null;
  deposito?: number | null;
  interes_por_dia?: number | null;
  dias_gracia?: number | null;
  medios_pago: number[]; // Obligatorio: al menos un medio de pago
}

export interface CreateInmuebleCompletoPayload {
  tipo: number;
  descripcion?: string | null;
  provincia: string;
  ciudad: string;
  barrio: string;
  direccion: string;
  numero: number;
  piso?: string | null;
  m2_totales: number;
  m2_cubiertos: number;
  ambientes: number;
  dormitorios: number;
  banos: number;
  antiguedad?: number | null;
  precio_publicado: number;
  estado_alquiler: EstadoAlquiler;
  fecha_disponible?: string | null;
  servicios?: number | null;
  tags?: number[];
  fotos: CreateFotoPayload[];
  condiciones_contrato: CreateContratoCondicionesPayload;
}

/**
 * Item para la vista "Mis Propiedades / Mis Alquileres" del Locador
 */
export interface MisAlquileresItem {
  id_inmueble: number;
  titulo_direccion: string; // Dirección formateada utilizada como título
  provincia: string;
  ciudad: string;
  barrio: string;
  direccion: string;
  numero: number;
  piso?: string | null;
  m2_totales: number;
  m2_cubiertos: number;
  ambientes: number;
  dormitorios: number;
  banos: number;
  antiguedad?: number | null;
  descripcion?: string | null;
  tipo_inmueble: string;
  precio_publicado: number;
  estado_alquiler: EstadoAlquiler;
  fecha_disponible?: string | null;
  servicio?: string | null;
  tags: string[];
  foto_principal: string | null;
  fotos: FotoInmueble[];
  contrato: {
    id: number;
    monto_alquiler: number;
    expensas: number;
    indice_aumento?: string | null;
    frecuencia_ajuste?: string | null;
    duracion_meses?: number | null;
    deposito?: number | null;
    interes_por_dia?: number | null;
    dias_gracia?: number | null;
    medios_pago: string[];
  };
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string | null;
}

// ─── Tipos de vista del front (apps/web + packages/ui) ───────────────────────
// Archivos propios, uno por dominio. Qué es modelo del back y qué es tipo de
// vista, y qué adaptador los conecta: ver packages/shared-types/README.md.
export type {
  PropertyType,
  AdjustmentIndex,
  CharacteristicKey,
  CharacteristicOption,
  MedioPagoPreferido,
  MedioPagoConRecargo,
  EstadoPago,
  PropiedadResumen,
  ProximoAjuste,
  PropiedadLocador,
  EstadoPublicacionAlta,
  FotoNueva,
  PropiedadNueva,
} from './propiedad';
export type { NeighborhoodTier, Neighborhood } from './neighborhood';
export type {
  BedroomsFilter,
  FilterState,
  BusquedaFiltros,
  OrdenBusqueda,
  Paginado,
  MisPropiedadesFiltros,
  EstadoFiltroMisPropiedades,
  ReclamosFiltro,
  OrdenMisPropiedades,
  UbicacionOpciones,
} from './filters';
export type {
  PropertyStatus,
  ContractStatus,
  SignatureStatus,
  PaymentStatus,
  ClaimStatus,
  SubscriptionStatus,
  SolicitudStatus,
  UsuarioStatus,
  FacturaStatus,
  UserRole,
  StatusDomain,
  StatusDomainMap,
} from './status';
export type { UsuarioSesion } from './usuario-sesion';
export type {
  CobroPanel,
  ResumenCobros,
  ReclamoPanel,
  ResumenReclamos,
  EventoContratoPanel,
  SolicitudPanel,
  ResumenContextoRol,
} from './panel';
