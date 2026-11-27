import { NextFunction, Request, Response } from 'express';
import {
  ApiResponse,
  CrearConversacionRequest,
  EnviarMensajeRequest,
  ConversacionResponse,
  ConversacionDetalleResponse,
  MensajeResponse
} from '../dtos';
import { AuthenticatedUser } from '../gateway/middlewares/auth.middleware';
import { mensajeService, MensajeService } from '../services/mensaje.service';

export class MensajeController {
  constructor(private readonly service: MensajeService = mensajeService) {}

  private parseId(rawId: string | undefined): number | null {
    const id = typeof rawId === 'string' ? Number(rawId) : NaN;
    return Number.isInteger(id) && id > 0 ? id : null;
  }

  async crearConversacion(
    req: Request<unknown, unknown, CrearConversacionRequest>,
    res: Response<ApiResponse<ConversacionResponse>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = (req as any).user as AuthenticatedUser;
      const resultado = await this.service.iniciarConversacion(user, req.body);

      res.status(resultado.creada ? 201 : 200).json({
        success: true,
        message: resultado.creada ? 'Conversación iniciada exitosamente.' : 'Se reutilizó la conversación existente.',
        data: resultado.conversacion
      });
    } catch (error) {
      next(error);
    }
  }

  async listarConversaciones(
    req: Request,
    res: Response<ApiResponse<ConversacionResponse[]>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = (req as any).user as AuthenticatedUser;
      const conversaciones = await this.service.listarConversaciones(user);

      res.status(200).json({
        success: true,
        data: conversaciones
      });
    } catch (error) {
      next(error);
    }
  }

  async obtenerConversacion(
    req: Request<{ id: string }>,
    res: Response<ApiResponse<ConversacionDetalleResponse>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const idConversacion = this.parseId(req.params.id);
      if (idConversacion === null) {
        res.status(400).json({
          success: false,
          error: 'El identificador de la conversación no es válido.'
        });
        return;
      }

      const user = (req as any).user as AuthenticatedUser;
      const conversacion = await this.service.obtenerConversacion(user, idConversacion);

      res.status(200).json({
        success: true,
        data: conversacion
      });
    } catch (error) {
      next(error);
    }
  }

  async listarMensajes(
    req: Request<{ id: string }>,
    res: Response<ApiResponse<MensajeResponse[]>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const idConversacion = this.parseId(req.params.id);
      if (idConversacion === null) {
        res.status(400).json({
          success: false,
          error: 'El identificador de la conversación no es válido.'
        });
        return;
      }

      const user = (req as any).user as AuthenticatedUser;
      const mensajes = await this.service.listarMensajes(user, idConversacion);

      res.status(200).json({
        success: true,
        data: mensajes
      });
    } catch (error) {
      next(error);
    }
  }

  async enviarMensaje(
    req: Request<{ id: string }, unknown, EnviarMensajeRequest>,
    res: Response<ApiResponse<MensajeResponse>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const idConversacion = this.parseId(req.params.id);
      if (idConversacion === null) {
        res.status(400).json({
          success: false,
          error: 'El identificador de la conversación no es válido.'
        });
        return;
      }

      const user = (req as any).user as AuthenticatedUser;
      const mensaje = await this.service.enviarMensaje(user, idConversacion, req.body?.contenido);

      res.status(201).json({
        success: true,
        message: 'Mensaje enviado exitosamente.',
        data: mensaje
      });
    } catch (error) {
      next(error);
    }
  }

  async eliminarMensaje(
    req: Request<{ id: string }>,
    res: Response<ApiResponse<{ id: number }>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const idMensaje = this.parseId(req.params.id);
      if (idMensaje === null) {
        res.status(400).json({
          success: false,
          error: 'El identificador del mensaje no es válido.'
        });
        return;
      }

      const user = (req as any).user as AuthenticatedUser;
      await this.service.eliminarMensaje(user, idMensaje);

      res.status(200).json({
        success: true,
        message: 'Mensaje eliminado exitosamente.',
        data: { id: idMensaje }
      });
    } catch (error) {
      next(error);
    }
  }
}

export const mensajeController = new MensajeController();
