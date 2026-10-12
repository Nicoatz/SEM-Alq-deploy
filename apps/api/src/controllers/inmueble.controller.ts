import { Request, Response, NextFunction } from 'express';
import { inmuebleService } from '../services/inmueble.service';
import { ApiResponse, InmuebleDTO, InmuebleDetalleDTO, FiltrosInmueblesDisponiblesDTO,
  InmueblesDisponiblesResultadoDTO, } from '../dtos';

export class InmuebleController {
  async getAll(req: Request, res: Response<ApiResponse<InmuebleDTO[]>>, next: NextFunction): Promise<void> {
    try {
      const inmuebles = await inmuebleService.findAll();
      res.status(200).json({
        success: true,
        message: 'Inmuebles obtenidos exitosamente',
        data: inmuebles
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response<ApiResponse<InmuebleDetalleDTO>>, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: 'El ID proporcionado debe ser un número entero válido.'
        });
        return;
      }

      const inmueble = await inmuebleService.getById(id);
      if (!inmueble) {
        res.status(404).json({
          success: false,
          error: `Inmueble con ID ${id} no encontrado.`
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: inmueble
      });
    } catch (error) {
      next(error);
    }
  }

  async getInmueblesDisponibles(
    req: Request,
    res: Response<ApiResponse<InmueblesDisponiblesResultadoDTO>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const filtros: FiltrosInmueblesDisponiblesDTO = {
        barrio: req.query.barrio
          ? String(req.query.barrio)
          : undefined,
  
        precioMin: req.query.precioMin
          ? Number(req.query.precioMin)
          : undefined,
  
        precioMax: req.query.precioMax
          ? Number(req.query.precioMax)
          : undefined,
  
        tipo: req.query.tipo
          ? Number(req.query.tipo)
          : undefined,
  
        dormitorios: req.query.dormitorios
          ? Number(req.query.dormitorios)
          : undefined,
  
        ambientes: req.query.ambientes
          ? Number(req.query.ambientes)
          : undefined,
  
        superficieMin: req.query.superficieMin
          ? Number(req.query.superficieMin)
          : undefined,
  
        superficieMax: req.query.superficieMax
          ? Number(req.query.superficieMax)
          : undefined,
  
        tags: req.query.tags
          ? String(req.query.tags)
              .split(',')
              .map(Number)
          : undefined,
  
        indiceAjuste: req.query.indiceAjuste
          ? Number(req.query.indiceAjuste)
          : undefined,
  
        page: req.query.page
          ? Number(req.query.page)
          : undefined,
  
        limit: req.query.limit
          ? Number(req.query.limit)
          : undefined,
  
        orden: req.query.orden as
          | 'precio'
          | 'dormitorios'
          | 'm2'
          | undefined,
  
        direccion: req.query.direccion as
          | 'asc'
          | 'desc'
          | undefined
      };
  
      const resultado =
        await inmuebleService.getInmueblesDisponibles(filtros);
  
      res.status(200).json({
        success: true,
        message: 'Propiedades disponibles obtenidas exitosamente',
        data: resultado
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Endpoint de registro de propiedad (US-01).
   * Todo inmueble debe registrarse con fotos y condiciones de contrato asociadas.
   */
  async create(req: Request, res: Response<ApiResponse<InmuebleDTO>>, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user;
      const locadorId = user.id;

      const nuevo = await inmuebleService.registrarPropiedadCompleta(req.body, locadorId);
      res.status(201).json({
        success: true,
        message: 'Propiedad registrada exitosamente con contrato y fotos vinculadas.',
        data: nuevo
      });
    } catch (error) {
      next(error);
    }
  }
  // TODO: mantener consistencia con la creación. Pendiente para cuando se defina la US de modificar propiedades.
  async update(req: Request, res: Response<ApiResponse<InmuebleDTO>>, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({
          success: false,
          error: 'ID inválido.'
        });
        return;
      }

      const user = (req as any).user;

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'No autorizado.'
        });
        return;
      }

      const actualizado = await inmuebleService.update(
        id,
        user.id,
        req.body
      );

      if (!actualizado) {
        res.status(404).json({
          success: false,
          error: `Inmueble con ID ${id} no encontrado.`
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Inmueble actualizado exitosamente.',
        data: actualizado
      });
    } catch (error) {
      next(error);
    }
  }

  async delete(
    req: Request,
    res: Response<ApiResponse<null>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
  
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: 'ID inválido.'
        });
        return;
      }
  
      const user = (req as any).user;
  
      if (!user) {
        res.status(401).json({
          success: false,
          error: 'No autorizado.'
        });
        return;
      }
  
      const eliminado = await inmuebleService.delete(id, user.id);
  
      if (!eliminado) {
        res.status(404).json({
          success: false,
          error: `Inmueble con ID ${id} no encontrado.`
        });
        return;
      }
  
      res.status(200).json({
        success: true,
        message: 'Inmueble eliminado correctamente.'
      });
    } catch (error) {
      next(error);
    }
  }

}

export const inmuebleController = new InmuebleController();

