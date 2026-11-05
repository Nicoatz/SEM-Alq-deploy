import type { NextFunction, Request, Response } from 'express';
import type {
  ApiResponse,
  DetalleCobroConsultaDTO,
  EstadoConsultaCobroDTO,
  FiltrosHistorialCobrosLocadorDTO,
  FiltrosPagosLocatarioDTO,
  HistorialCobrosLocadorResultadoDTO,
  MedioCobroManualDTO,
  PagosLocatarioResultadoDTO,
} from '../dtos';
import type { AuthenticatedUser } from '../gateway/middlewares/auth.middleware';
import { cobroConsultaService } from '../services/cobro-consulta.service';

const ESTADOS: readonly EstadoConsultaCobroDTO[] = ['todos', 'pendiente', 'vencido', 'pagado'];
const MEDIOS: readonly MedioCobroManualDTO[] = [
  'transferencia', 'efectivo', 'cheque', 'mercadopago_externo', 'otro',
];

function usuarioAutenticado(req: Request): AuthenticatedUser | null {
  return (req as Request & { user?: AuthenticatedUser }).user ?? null;
}

function validationError(message: string): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode: 400 });
}

function optionalPositiveInteger(value: unknown, name: string, maximum?: number): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw validationError(`El filtro ${name} debe ser un entero positivo.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0 || (maximum !== undefined && parsed > maximum)) {
    throw validationError(`El filtro ${name} está fuera del rango permitido.`);
  }
  return parsed;
}

function optionalMonth(value: unknown, name: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    throw validationError(`El filtro ${name} debe tener formato YYYY-MM.`);
  }
  return value;
}

function optionalState(value: unknown): EstadoConsultaCobroDTO | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !ESTADOS.includes(value as EstadoConsultaCobroDTO)) {
    throw validationError(`El estado debe ser uno de: ${ESTADOS.join(', ')}.`);
  }
  return value as EstadoConsultaCobroDTO;
}

function pagination(query: Request['query']): { page?: number; limit?: number } {
  return {
    page: optionalPositiveInteger(query.page, 'page'),
    limit: optionalPositiveInteger(query.limit, 'limit', 100),
  };
}

export class CobroConsultaController {
  async historialLocador(
    req: Request,
    res: Response<ApiResponse<HistorialCobrosLocadorResultadoDTO>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = usuarioAutenticado(req);
      if (!user) {
        res.status(401).json({ success: false, error: 'No autorizado.' });
        return;
      }

      const estado = optionalState(req.query.estado);
      const periodo = optionalMonth(req.query.periodo, 'periodo');
      const desde = optionalMonth(req.query.desde, 'desde');
      const hasta = optionalMonth(req.query.hasta, 'hasta');
      if (desde && hasta && desde > hasta) {
        throw validationError('El filtro desde no puede ser posterior a hasta.');
      }

      const filtros: FiltrosHistorialCobrosLocadorDTO = {
        estado,
        id_inmueble: optionalPositiveInteger(req.query.id_inmueble, 'id_inmueble'),
        periodo,
        desde,
        hasta,
        ...pagination(req.query),
      };
      const data = await cobroConsultaService.historialLocador(user.id, filtros);
      res.status(200).json({ success: true, message: 'Historial de cobros obtenido.', data });
    } catch (error) {
      next(error);
    }
  }

  async pagosLocatario(
    req: Request,
    res: Response<ApiResponse<PagosLocatarioResultadoDTO>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = usuarioAutenticado(req);
      if (!user) {
        res.status(401).json({ success: false, error: 'No autorizado.' });
        return;
      }

      const estado = optionalState(req.query.estado);
      const anio = optionalPositiveInteger(req.query.anio, 'anio', new Date().getUTCFullYear() + 10);
      if (anio !== undefined && anio < 2000) throw validationError('El filtro anio debe ser posterior a 1999.');
      const medioQuery = req.query.medio;
      if (medioQuery !== undefined && (
        typeof medioQuery !== 'string' || !MEDIOS.includes(medioQuery as MedioCobroManualDTO)
      )) {
        throw validationError(`El medio debe ser uno de: ${MEDIOS.join(', ')}.`);
      }

      const filtros: FiltrosPagosLocatarioDTO = {
        anio,
        estado,
        medio: medioQuery as MedioCobroManualDTO | undefined,
        ...pagination(req.query),
      };
      const data = await cobroConsultaService.pagosLocatario(user.id, filtros);
      res.status(200).json({ success: true, message: 'Pagos del locatario obtenidos.', data });
    } catch (error) {
      next(error);
    }
  }

  async detalle(
    req: Request<{ id: string }>,
    res: Response<ApiResponse<DetalleCobroConsultaDTO>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = usuarioAutenticado(req);
      if (!user) {
        res.status(401).json({ success: false, error: 'No autorizado.' });
        return;
      }
      const idPeriodo = Number(req.params.id);
      if (!Number.isSafeInteger(idPeriodo) || idPeriodo <= 0) {
        res.status(400).json({ success: false, error: 'El ID del cobro debe ser un entero positivo.' });
        return;
      }

      const data = await cobroConsultaService.detalle(idPeriodo, user.id);
      res.status(200).json({ success: true, message: 'Detalle del período obtenido.', data });
    } catch (error) {
      next(error);
    }
  }
}

export const cobroConsultaController = new CobroConsultaController();