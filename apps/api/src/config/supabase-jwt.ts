import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

const getJwks = () => {
  if (jwks) return jwks;

  const jwksUrl = process.env.SUPABASE_JWKS_URL;
  if (!jwksUrl) {
    const error = new Error('La configuración SUPABASE_JWKS_URL no está definida.');
    (error as any).statusCode = 500;
    throw error;
  }

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

  const { payload } = await jwtVerify(token, getJwks(), {
    issuer: `${supabaseUrl}/auth/v1`,
    audience: 'authenticated'
  });

  return payload;
};