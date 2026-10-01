import type { JWTPayload } from 'jose' with { 'resolution-mode': 'import' };

type JoseModule = typeof import('jose', { with: { 'resolution-mode': 'import' } });

let joseModule: Promise<JoseModule> | null = null;
let jwks: ReturnType<JoseModule['createRemoteJWKSet']> | null = null;

const loadJose = () => {
  joseModule ??= import('jose');
  return joseModule;
};

const getJwks = async () => {
  if (jwks) return jwks;

  const jwksUrl = process.env.SUPABASE_JWKS_URL;
  if (!jwksUrl) {
    const error = new Error('La configuración SUPABASE_JWKS_URL no está definida.');
    (error as any).statusCode = 500;
    throw error;
  }

  const { createRemoteJWKSet } = await loadJose();
  jwks = createRemoteJWKSet(new URL(jwksUrl));
  return jwks;
};

export const verifySupabaseAccessToken = async (token: string): Promise<JWTPayload> => {
  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl) {
    const error = new Error('La configuración SUPABASE_URL no está definida.');
    (error as any).statusCode = 500;
    throw error;
  }

  const { jwtVerify } = await loadJose();
  const { payload } = await jwtVerify(token, await getJwks(), {
    issuer: `${supabaseUrl}/auth/v1`,
    audience: 'authenticated'
  });

  return payload;
};