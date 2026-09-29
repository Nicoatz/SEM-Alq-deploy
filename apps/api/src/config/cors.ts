import type { CorsOptions } from 'cors';

/**
 * Orígenes que pueden llamar a la API desde el navegador.
 *
 * Se leen de CORS_ORIGIN: una URL o varias separadas por coma
 * (ej. "https://rentar-web.vercel.app,http://localhost:3001").
 * Sin la variable, vale solo el front local (apps/web corre en el 3001).
 *
 * NOTA: en Vercel hay que cargar CORS_ORIGIN con la URL de rentar-web;
 * si no, el navegador bloquea las llamadas del front desplegado.
 */
const DEFAULT_ORIGIN = 'http://localhost:3001';

const parseOrigins = (value: string | undefined): string[] => {
  const origins = (value ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  return origins.length > 0 ? origins : [DEFAULT_ORIGIN];
};

export const corsOptions = (): CorsOptions => ({
  origin: parseOrigins(process.env.CORS_ORIGIN)
});
