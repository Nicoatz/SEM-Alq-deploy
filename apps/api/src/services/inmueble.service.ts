import {
  InmuebleDTO,
  InmuebleDetalleDTO,
  CreateInmuebleDTO,
  UpdateInmuebleDTO,
  CreateInmuebleCompletoDTO,
  MisAlquileresDTO,
  FiltrosInmueblesDisponiblesDTO,
  InmueblesDisponiblesResultadoDTO,
} from '../dtos';
import { IInmuebleRepository, inmuebleRepository } from '../repositories/inmueble.repository';
import { IContratoRepository, contratoRepository } from '../repositories/contrato.repository';
import { lookupRepository } from '../repositories/lookup.repository';

export class InmuebleService {
  constructor(
    private inmRepo: IInmuebleRepository = inmuebleRepository,
    private contRepo: IContratoRepository = contratoRepository
  ) {}

  async findAll(): Promise<InmuebleDTO[]> {
    return await this.inmRepo.findAll();
  }

  async getById(id: number): Promise<InmuebleDetalleDTO | null> {
    const inmueble = await this.inmRepo.findDisponibleById(id);
  
    if (!inmueble) return null;
  
    const tipo = Array.isArray(inmueble.tipo_inmueble)
      ? inmueble.tipo_inmueble[0]
      : inmueble.tipo_inmueble;
  
    const servicio = Array.isArray(inmueble.servicio)
      ? inmueble.servicio[0]
      : inmueble.servicio;
  
    const contrato = Array.isArray(inmueble.contrato)
      ? inmueble.contrato[0]
      : inmueble.contrato;
  
    const indiceAjuste = Array.isArray(contrato?.tipo_indice)
      ? contrato.tipo_indice[0]
      : contrato?.tipo_indice;
  
    const tags = (inmueble.inmueble_x_tag ?? [])
      .map((item: any) => {
        const tag = Array.isArray(item.tags_inmueble)
          ? item.tags_inmueble[0]
          : item.tags_inmueble;
  
        return tag
          ? {
              id: tag.id,
              descripcion: tag.descripcion
            }
          : null;
      })
      .filter(Boolean);
  
    const fotos = inmueble.foto_inmueble ?? [];
  
    return {
      id: inmueble.id,
  
      tipo: {
        id: tipo?.id,
        descripcion: tipo?.descripcion
      },
  
      direccion: inmueble.direccion,
      numero: inmueble.numero,
      piso: inmueble.piso,
      ciudad: inmueble.ciudad,
      barrio: inmueble.barrio,
      provincia: inmueble.provincia,
  
      ambientes: inmueble.ambientes,
      dormitorios: inmueble.dormitorios,
      banos: inmueble.banos,
  
      m2_totales: inmueble.m2_totales,
      m2_cubiertos: inmueble.m2_cubiertos,
  
      descripcion: inmueble.descripcion,
  
      precio: contrato?.monto_alquiler,
      expensas: contrato?.expensas,
  
      indice_ajuste: indiceAjuste
        ? {
            id: indiceAjuste.id,
            descripcion: indiceAjuste.descripcion
          }
        : null,
  
      fecha_disponible: inmueble.fecha_disponible,
  
      tags,
  
      servicio: servicio
        ? {
            id: servicio.id,
            nombre: servicio.nombre,
            descripcion: servicio.descripcion
          }
        : null,
  
      fotos
    };
  }

  async getInmueblesDisponibles(
    filtros: FiltrosInmueblesDisponiblesDTO
  ): Promise<InmueblesDisponiblesResultadoDTO> {
    return await this.inmRepo.buscarDisponibles(filtros);
  }

  async create(data: CreateInmuebleDTO): Promise<InmuebleDTO> {
    if (!data.direccion || !data.numero || !data.ciudad) {
      throw new Error('Dirección, número y ciudad son campos requeridos.');
    }
    const nuevo = await this.inmRepo.create({
      id_locador: data.id_locador || 1,
      tipo: data.tipo,
      descripcion: data.descripcion || null,
      provincia: data.provincia || 'Córdoba',
      ciudad: data.ciudad,
      barrio: data.barrio || 'Centro',
      direccion: data.direccion,
      numero: data.numero,
      piso: data.piso || null,
      m2_totales: data.m2_totales || data.m2 || 50,
      m2_cubiertos: data.m2_cubiertos || data.m2 || 45,
      ambientes: data.ambientes,
      dormitorios: data.dormitorios,
      banos: data.banos,
      antiguedad: data.antiguedad || null,
      precio_publicado: data.precio_publicado || 100000,
      estado_alquiler: data.estado_alquiler || 'publicado',
      fecha_disponible: data.fecha_disponible || null,
      servicios: data.servicios || null
    });
    return nuevo;
  }

  async update(id: number, data: UpdateInmuebleDTO): Promise<InmuebleDTO | null> {
    const existing = await this.inmRepo.findById(id);
    if (!existing) {
      throw new Error(`Inmueble con ID ${id} no encontrado.`);
    }
    return await this.inmRepo.update(id, data);
  }

  async delete(id: number): Promise<boolean> {
    const existing = await this.inmRepo.findById(id);
    if (!existing) {
      throw new Error(`Inmueble con ID ${id} no encontrado.`);
    }
    await this.contRepo.deleteByInmuebleId(id);
    return await this.inmRepo.delete(id);
  }

  /**
   * Validador exhaustivo de reglas de negocio US-01 (Registrar mis propiedades)
   */
  private async validarReglasUS01(data: CreateInmuebleCompletoDTO, idLocador: number): Promise<void> {
    if (!idLocador) {
      throw new Error('Se debe haber iniciado sesión como locador.');
    }

    if (
      !data.provincia?.trim() ||
      !data.ciudad?.trim() ||
      !data.barrio?.trim()
    ) {
      throw new Error('Se debe indicar la ciudad, provincia y barrio en los que se encuentra la propiedad.');
    }
    if (!data.direccion?.trim()) {
      throw new Error('Se debe indicar la calle en la que se encuentra la propiedad.');
    }
    if (data.numero === undefined || data.numero === null || isNaN(data.numero)) {
      throw new Error('Se debe indicar a qué altura de la calle se encuentra la propiedad.');
    }

    if (
      data.m2_totales === undefined ||
      data.m2_totales === null ||
      data.m2_totales <= 0 ||
      data.m2_cubiertos === undefined ||
      data.m2_cubiertos === null ||
      data.m2_cubiertos <= 0
    ) {
      throw new Error('Se deben indicar los metros cuadrados (deben ser mayores a 0).');
    }

    if (!data.tipo) {
      throw new Error('Se debe indicar el tipo de propiedad (casa, departamento, monoambiente).');
    }
    const tipoObj = await lookupRepository.getTipoById(data.tipo);
    if (!tipoObj) {
      throw new Error(`El tipo de propiedad especificado (${data.tipo}) no existe.`);
    }

    const esMonoambiente = tipoObj.descripcion.toLowerCase() === 'monoambiente' || data.tipo === 4;

    if (esMonoambiente) {
      if (data.ambientes > 1) {
        throw new Error('Un monoambiente no puede tener más de un ambiente.');
      }
      if (data.dormitorios > 1) {
        throw new Error('Un monoambiente no puede tener más de un dormitorio.');
      }
    } else {
      if (data.ambientes === undefined || data.ambientes === null || data.ambientes < 2) {
        throw new Error('Una propiedad que no es monoambiente debe tener al menos 2 ambientes.');
      }
      if (data.dormitorios === undefined || data.dormitorios === null || data.dormitorios < 1) {
        throw new Error('Una propiedad que no es monoambiente debe tener al menos 1 habitación.');
      }
    }

    if (data.banos === undefined || data.banos === null || data.banos <= 0) {
      throw new Error('Se debe indicar la cantidad de baños (debe ser mayor a 0).');
    }

    if (!data.estado_alquiler || !['publicado', 'pausado', 'alquilado'].includes(data.estado_alquiler)) {
      throw new Error('Se debe indicar el estado del alquiler: publicado, pausado o alquilado.');
    }

    if (data.precio_publicado === undefined || data.precio_publicado === null || data.precio_publicado <= 0) {
      throw new Error('Se debe indicar el monto de precio publicado (mayor a 0).');
    }

    if (!data.condiciones_contrato) {
      throw new Error('Se deben indicar las condiciones comerciales del contrato.');
    }
    if (
      data.condiciones_contrato.monto_alquiler === undefined ||
      data.condiciones_contrato.monto_alquiler === null ||
      data.condiciones_contrato.monto_alquiler <= 0
    ) {
      throw new Error('Se debe indicar el monto de alquiler de la propiedad.');
    }
    if (
      data.condiciones_contrato.expensas === undefined ||
      data.condiciones_contrato.expensas === null ||
      data.condiciones_contrato.expensas < 0
    ) {
      throw new Error('Se debe indicar el monto de las expensas de la propiedad.');
    }

    if (
      data.condiciones_contrato.interes_por_dia !== undefined &&
      data.condiciones_contrato.interes_por_dia !== null &&
      data.condiciones_contrato.interes_por_dia > 0
    ) {
      if (
        data.condiciones_contrato.dias_gracia === undefined ||
        data.condiciones_contrato.dias_gracia === null
      ) {
        throw new Error('Si se indicó el interés por día, se deben indicar los días de gracia.');
      }
    }

    if (
      !data.condiciones_contrato.medios_pago ||
      !Array.isArray(data.condiciones_contrato.medios_pago) ||
      data.condiciones_contrato.medios_pago.length === 0
    ) {
      throw new Error('Cada contrato debe tener al menos una forma de pago asociada.');
    }

    if (!data.fotos || !Array.isArray(data.fotos) || data.fotos.length < 3) {
      throw new Error('Se deben cargar al menos tres fotos de la propiedad.');
    }
    if (data.fotos.length > 50) {
      throw new Error('Se pueden cargar hasta 50 fotos por propiedad.');
    }

    for (const foto of data.fotos) {
      const formatoL = (foto.formato || '').toLowerCase();
      if (!['jpg', 'jpeg', 'png'].includes(formatoL)) {
        throw new Error('Las fotos deberán estar en formato JPG o PNG.');
      }
      if (foto.peso_kb > 350) {
        throw new Error('Las fotos no deben superar los 350kb de peso.');
      }
    }
  }

  /**
   * Orquestación atómica: Crea Inmueble + Fotos + Tags + Contrato (condiciones comerciales) + Medios de pago.
   * Con rollback ante cualquier fallo o excepción.
   */
  async registrarPropiedadCompleta(
    data: CreateInmuebleCompletoDTO,
    idLocador: number
  ): Promise<InmuebleDTO> {
    await this.validarReglasUS01(data, idLocador);

    let inmuebleCreadoId: number | null = null;

    try {
      const nuevoInmueble = await this.inmRepo.create({
        id_locador: idLocador,
        tipo: data.tipo,
        descripcion: data.descripcion || null,
        provincia: data.provincia,
        ciudad: data.ciudad,
        barrio: data.barrio,
        direccion: data.direccion,
        numero: data.numero,
        piso: data.piso || null,
        m2_totales: data.m2_totales,
        m2_cubiertos: data.m2_cubiertos,
        ambientes: data.ambientes,
        dormitorios: data.dormitorios,
        banos: data.banos,
        antiguedad: data.antiguedad !== undefined ? data.antiguedad : null,
        precio_publicado: data.precio_publicado,
        estado_alquiler: data.estado_alquiler,
        fecha_disponible: data.fecha_disponible || null,
        servicios: data.servicios || null
      });

      inmuebleCreadoId = nuevoInmueble.id;

      await this.inmRepo.addFotos(inmuebleCreadoId, data.fotos);

      if (data.tags && data.tags.length > 0) {
        await this.inmRepo.addTags(inmuebleCreadoId, data.tags);
      }

      await this.contRepo.create(
        {
          id_inmueble: inmuebleCreadoId,
          monto_alquiler: data.condiciones_contrato.monto_alquiler,
          expensas: data.condiciones_contrato.expensas,
          indice_aumento: data.condiciones_contrato.indice_aumento || null,
          frecuencia_ajuste: data.condiciones_contrato.frecuencia_ajuste || null,
          duracion_meses: data.condiciones_contrato.duracion_meses || null,
          deposito: data.condiciones_contrato.deposito || null,
          interes_por_dia: data.condiciones_contrato.interes_por_dia || null,
          dias_gracia: data.condiciones_contrato.dias_gracia || null,
          fecha_inicio_contrato: null,
          fecha_fin_contrato: null,
          estado: 1
        },
        data.condiciones_contrato.medios_pago
      );

      return nuevoInmueble;
    } catch (error) {
      if (inmuebleCreadoId) {
        await this.inmRepo.delete(inmuebleCreadoId);
        await this.contRepo.deleteByInmuebleId(inmuebleCreadoId);
      }
      throw error;
    }
  }

  async getMisInmueblesPublicados(idLocador: number): Promise<MisAlquileresDTO[]> {
    const inmuebles = await this.inmRepo.findByLocadorId(idLocador);
    const resultado: MisAlquileresDTO[] = [];

    for (const inm of inmuebles) {
      const tipoObj = await lookupRepository.getTipoById(inm.tipo);
      const servicioObj = inm.servicios ? await lookupRepository.getServicioById(inm.servicios) : null;
      const tagsObjs = await this.inmRepo.getTagsByInmuebleId(inm.id);
      const fotos = await this.inmRepo.getFotosByInmuebleId(inm.id);
      const fotoPrincipal = fotos.find(f => f.es_principal)?.url || (fotos.length > 0 ? fotos[0].url : null);

      const contrato = await this.contRepo.findByInmuebleId(inm.id);
      let mediosPagoNombres: string[] = [];
      let indiceDescripcion: string | null = null;

      if (contrato) {
        const mediosPagoObjs = await this.contRepo.getMediosPagoByContratoId(contrato.id);
        mediosPagoNombres = mediosPagoObjs.map(m => m.nombre);
        if (contrato.indice_aumento) {
          const idxObj = await lookupRepository.getTipoIndiceById(contrato.indice_aumento);
          indiceDescripcion = idxObj ? idxObj.descripcion : null;
        }
      }

      const pisoTexto = inm.piso ? ` Piso ${inm.piso}` : '';
      const tituloDireccion = `${inm.direccion} ${inm.numero}${pisoTexto}, ${inm.barrio}, ${inm.ciudad}`;

      resultado.push({
        id_inmueble: inm.id,
        titulo_direccion: tituloDireccion,
        provincia: inm.provincia,
        ciudad: inm.ciudad,
        barrio: inm.barrio,
        direccion: inm.direccion,
        numero: inm.numero,
        piso: inm.piso,
        m2_totales: inm.m2_totales,
        m2_cubiertos: inm.m2_cubiertos,
        ambientes: inm.ambientes,
        dormitorios: inm.dormitorios,
        banos: inm.banos,
        antiguedad: inm.antiguedad,
        descripcion: inm.descripcion,
        tipo_inmueble: tipoObj ? tipoObj.descripcion : 'Inmueble',
        precio_publicado: inm.precio_publicado,
        estado_alquiler: inm.estado_alquiler,
        fecha_disponible: inm.fecha_disponible,
        servicio: servicioObj ? `${servicioObj.nombre} (${servicioObj.descripcion})` : null,
        tags: tagsObjs.map(t => t.descripcion),
        foto_principal: fotoPrincipal,
        fotos: fotos,
        contrato: {
          id: contrato ? contrato.id : 0,
          monto_alquiler: contrato ? contrato.monto_alquiler : inm.precio_publicado,
          expensas: contrato ? contrato.expensas : 0,
          indice_aumento: indiceDescripcion,
          frecuencia_ajuste: contrato?.frecuencia_ajuste || null,
          duracion_meses: contrato?.duracion_meses || null,
          deposito: contrato?.deposito || null,
          interes_por_dia: contrato?.interes_por_dia || null,
          dias_gracia: contrato?.dias_gracia || null,
          medios_pago: mediosPagoNombres
        }
      });
    }

    return resultado;
  }
}

export const inmuebleService = new InmuebleService();

