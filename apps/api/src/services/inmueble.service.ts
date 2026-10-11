import {
  InmuebleDTO,
  InmuebleDetalleDTO,
  InmuebleDisponibleDTO,
  CreateInmuebleDTO,
  UpdateInmuebleDTO,
  CreateInmuebleCompletoDTO,
  MisAlquileresDTO,
  FiltrosMisAlquileresDTO,
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
  
    const tipoObj = await lookupRepository.getTipoById(inmueble.tipo);
  
    const servicioObj = inmueble.servicios ? await lookupRepository.getServicioById(inmueble.servicios): null;

    const contrato = await this.contRepo.findByInmuebleId(inmueble.id);
    const fotos = await this.inmRepo.getFotosByInmuebleId(inmueble.id);
    const tags = await this.inmRepo.getTagsByInmuebleId(inmueble.id);

    const indiceAjuste = contrato?.indice_aumento ? await lookupRepository.getTipoIndiceById(contrato.indice_aumento): null;
   
  
    return {
      id: inmueble.id,

      tipo: {
            id: tipoObj?.id ?? 0,
            descripcion: tipoObj?.descripcion ?? ''
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

      precio: contrato?.monto_alquiler ?? null,

      expensas: contrato?.expensas ?? null,

      indice_ajuste: indiceAjuste
        ? {
            id: indiceAjuste.id,
            descripcion: indiceAjuste.descripcion
          }
        : null,

      fecha_disponible: inmueble.fecha_disponible,

      tags,

      servicio: servicioObj
        ? {
            id: servicioObj.id,
            nombre: servicioObj.nombre,
            descripcion: servicioObj.descripcion
          }
        : null,

      fotos
    };
  }

  async getInmueblesDisponibles(filtros: FiltrosInmueblesDisponiblesDTO): Promise<InmueblesDisponiblesResultadoDTO> {
    const { items: inmuebles, total, page, limit } = await this.inmRepo.buscarDisponibles(filtros);
    const totalPages = Math.ceil(total / limit);

    if (page > Math.max(totalPages, 1)) {
      const error = new Error('La página solicitada no existe.');
      Object.assign(error, { statusCode: 400 });
      throw error;
    }

    const items: InmuebleDisponibleDTO[] = [];

    for (const inmueble of inmuebles) {
      const tipoObj = await lookupRepository.getTipoById(
        inmueble.tipo
      );

      const contrato = await this.contRepo.findByInmuebleId(
        inmueble.id
      );

      const indiceAjuste = contrato?.indice_aumento
        ? await lookupRepository.getTipoIndiceById(
            contrato.indice_aumento
          )
        : null;

      const tags = await this.inmRepo.getTagsByInmuebleId(
        inmueble.id
      );

      const fotos = await this.inmRepo.getFotosByInmuebleId(
        inmueble.id
      );

      const fotoPrincipal =
        fotos.find(f => f.es_principal)?.url ??
        fotos[0]?.url ??
        null;

      items.push({
        id: inmueble.id,

        tipo: {
          id: tipoObj?.id ?? 0,
          descripcion: tipoObj?.descripcion ?? ''
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

        precio:
          contrato?.monto_alquiler ??
          Number(inmueble.precio_publicado),

        expensas:
          contrato?.expensas ?? 0,

        indice_ajuste: indiceAjuste
          ? {
              id: indiceAjuste.id,
              descripcion: indiceAjuste.descripcion
            }
          : null,

        fecha_disponible:
          inmueble.fecha_disponible,

        tags: tags.map(tag => ({
          id: tag.id,
          descripcion: tag.descripcion
        })),

        foto_principal: fotoPrincipal
      });
    }

    return {
      items,
      total,
      page,
      limit,
      totalPages
    };
  }

  async update(
    id: number,
    idLocador: number,
    data: UpdateInmuebleDTO
  ): Promise<InmuebleDTO | null> {
    const existing = await this.inmRepo.findById(id);

    if (!existing) {
      const error = new Error(`Inmueble con ID ${id} no encontrado.`);
      Object.assign(error, { statusCode: 404 });
      throw error;
    }

    if (existing.id_locador !== idLocador) {
      const error = new Error(
        'No tenés permiso para modificar este inmueble.'
      );
      Object.assign(error, { statusCode: 403 });
      throw error;
    }

    if (
      existing.estado_alquiler === 'alquilado' ||
      existing.estado_alquiler === 'publicado/alquilado'
    ) {
      const error = new Error(
        'No se puede modificar una propiedad que está alquilada.'
      );
      Object.assign(error, { statusCode: 409 });
      throw error;
    }

    const datosActualizables = data;

    return await this.inmRepo.actualizarPropiedadCompleta(
      id,
      idLocador,
      datosActualizables
    );
  }

  async delete(id: number, idLocador: number): Promise<boolean> {
    const resultado = await this.inmRepo.eliminarLogicamente(id, idLocador);
  
    if (!resultado.success) {
      const error = new Error(resultado.message);
      Object.assign(error, { statusCode: resultado.statusCode });
      throw error;
    }
  
    return true;
  }

  /**
   * Validador exhaustivo de reglas de negocio US-01 (Registrar mis propiedades)
   */
  private async validarReglasUS01(data: CreateInmuebleCompletoDTO, idLocador: number): Promise<void> {
    if (!idLocador) {
      throw new Error('Se debe haber iniciado sesión.');
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

    if (!data.estado_alquiler || !['publicado', 'pausado', 'alquilado', 'publicado/alquilado'].includes(data.estado_alquiler)) {
      throw new Error('Se debe indicar un estado de alquiler válido.');
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

    return this.inmRepo.registrarPropiedadCompleta(idLocador, data);
  }

  async getMisInmueblesPublicados(
    idLocador: number,
    filtros?: FiltrosMisAlquileresDTO
  ): Promise<MisAlquileresDTO[]> {
    const inmuebles = await this.inmRepo.findByLocadorId(idLocador, filtros);
    const resultado: MisAlquileresDTO[] = [];

    for (const inm of inmuebles) {
      const poseeReclamosNoResueltos = await this.inmRepo.poseeReclamosNoResueltos(inm.id);
      if (filtros?.reclamos !== undefined && poseeReclamosNoResueltos !== filtros.reclamos) continue;

      const tipoObj = await lookupRepository.getTipoById(inm.tipo);
      const servicioObj = inm.servicios ? await lookupRepository.getServicioById(inm.servicios) : null;
      const tagsObjs = await this.inmRepo.getTagsByInmuebleId(inm.id);
      const fotos = await this.inmRepo.getFotosByInmuebleId(inm.id);
      const fotoPrincipal = fotos.find(f => f.es_principal)?.url || (fotos.length > 0 ? fotos[0].url : null);

      const contrato = await this.contRepo.findByInmuebleId(inm.id);
      let mediosPagoNombres: string[] = [];
      let indiceDescripcion: string | null = null;
      const fechaProximoAjuste = contrato
        ? this.calcularFechaProximoAjuste(
            contrato.fecha_inicio_contrato,
            contrato.frecuencia_ajuste
          )
        : null;
      const locatario = contrato
        ? await this.contRepo.getLocatarioByContratoId(contrato.id)
        : null;

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
        posee_reclamos_no_resueltos: poseeReclamosNoResueltos,
        contrato: {
          id: contrato ? contrato.id : 0,
          locatario: locatario
            ? {
                id: locatario.id,
                nombre: locatario.nombre,
                apellido: locatario.apellido
              }
            : null,
          monto_alquiler: contrato ? contrato.monto_alquiler : inm.precio_publicado,
          expensas: contrato ? contrato.expensas : 0,
          indice_aumento: indiceDescripcion,
          fecha_proximo_ajuste: fechaProximoAjuste,
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

  async getBarriosByLocadorId(idLocador: number): Promise<string[]> {
    return this.inmRepo.findBarriosByLocadorId(idLocador);
  }

  private calcularFechaProximoAjuste(
    fechaInicio: string | null | undefined,
    frecuencia: string | null | undefined
  ): string | null {
    if (!fechaInicio || !frecuencia) return null;

    const mesesPorFrecuencia: Record<string, number> = {
      mensual: 1,
      bimestral: 2,
      trimestral: 3,
      cuatrimestral: 4,
      semestral: 6,
      anual: 12
    };
    const meses = mesesPorFrecuencia[frecuencia.trim().toLowerCase()];
    if (!meses) return null;

    const [anio, mes, dia] = fechaInicio.split('-').map(Number);
    if (!anio || !mes || !dia) return null;

    const hoy = new Date();
    const fecha = new Date(Date.UTC(anio, mes - 1, dia));

    while (fecha <= hoy) {
      fecha.setUTCMonth(fecha.getUTCMonth() + meses);
    }

    return fecha.toISOString().slice(0, 10);
  }
}

export const inmuebleService = new InmuebleService();

