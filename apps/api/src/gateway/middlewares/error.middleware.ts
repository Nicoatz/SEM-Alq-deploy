import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../../dtos';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response<ApiResponse<null>>,
  next: NextFunction
): void => {
  let statusCode = err.statusCode || err.status;
  let message = err.message || 'Ocurrió un error inesperado en el servidor.';

  // Errores de la función SQL actualizar_propiedad_completa.
  if (err.code === 'P0001') {
    if (message.includes('no encontrado o inactivo')) {
      statusCode = 404;
    } else if (message.includes('no pertenece a este locador')) {
      statusCode = 403;
    } else if (message.includes('está alquilada')) {
      statusCode = 409;
    } else {
      statusCode = 400;
    }
  }

  // Error de integridad o conversión de datos en PostgreSQL.
  if (!statusCode && err.code === '23503') {
    statusCode = 400;
  }

  if (!statusCode && err.code === '22P02') {
    statusCode = 400;
  }

  if (!statusCode) {
    statusCode = 500;
  }

  console.error(
    `[API Gateway Error] ${req.method} ${req.originalUrl} - Status: ${statusCode} - Mensaje: ${message}`
  );

  res.status(statusCode).json({
    success: false,
    message: 'Error en la solicitud',
    error: message
  });
};
