/**
 * Limitador de solicitudes por IP, para las rutas públicas (sin sesión) de la firma de garantes.
 *
 * NOTA: es "mejor esfuerzo". El contador vive en la memoria de cada instancia de la API: en
 * Vercel cada instancia lleva el suyo y se reinicia con ella, así que no frena a un atacante
 * decidido. Alcanza para cortar el uso abusivo (cada intento válido cuesta una llamada a
 * DocuSign) porque el token es de 256 bits y no se puede adivinar de ninguna manera.
 */
import { NextFunction, Request, Response } from 'express';

interface Opciones {
  /** Cantidad de solicitudes permitidas por ventana. */
  maximo: number;
  ventanaMs: number;
}

/**
 * IP del cliente. Detrás de Vercel, `req.ip` es la del proxy (todos compartirían un contador), así
 * que se prefiere la cabecera que el proxy completa con la IP real.
 */
function ipDelCliente(req: Request): string {
  const reenviada = req.header('x-forwarded-for')?.split(',')[0]?.trim();
  return req.header('x-real-ip') ?? reenviada ?? req.ip ?? 'desconocida';
}

export function limitarSolicitudes({ maximo, ventanaMs }: Opciones) {
  const contadores = new Map<string, { cantidad: number; reiniciaEn: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const ahora = Date.now();

    // Limpieza para que el mapa no crezca sin límite.
    if (contadores.size > 5000) {
      for (const [clave, valor] of contadores) {
        if (valor.reiniciaEn <= ahora) contadores.delete(clave);
      }
    }

    const clave = ipDelCliente(req);
    const actual = contadores.get(clave);

    if (!actual || actual.reiniciaEn <= ahora) {
      contadores.set(clave, { cantidad: 1, reiniciaEn: ahora + ventanaMs });
      next();
      return;
    }

    actual.cantidad += 1;

    if (actual.cantidad > maximo) {
      res.setHeader('Retry-After', String(Math.ceil((actual.reiniciaEn - ahora) / 1000)));
      res.status(429).json({
        success: false,
        error: 'Demasiados intentos. Probá de nuevo en unos minutos.',
      });
      return;
    }

    next();
  };
}
