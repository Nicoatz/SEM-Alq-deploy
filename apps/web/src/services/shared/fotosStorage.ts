/**
 * shared/fotosStorage.ts — subir y borrar fotos en un bucket de Supabase Storage.
 *
 * Qué es: la subida que comparten el alta y la edición de una propiedad (US-01 y
 * US-03, bucket `fotos-propiedades`) y el registro de un reclamo (US-14, bucket
 * `fotos-reclamos`). Las fotos no pasan por `apps/api`: el front las sube con la
 * sesión del usuario y después manda las URL públicas al back.
 *
 * Reglas de los dos buckets (migraciones de `supabase/`): públicos, solo
 * `image/jpeg` e `image/png`, 358400 bytes (350 KB) como máximo, y las políticas
 * de INSERT y DELETE exigen que la ruta empiece con `<auth.uid()>/`.
 *
 * Quién lo usa: `propiedades.service.ts` y `reclamos.service.ts` (rama real).
 */
import { getSupabaseBrowserClient } from '@/lib/auth/supabase/client'
import { TIPOS_FOTO_ACEPTADOS } from '@/lib/imagenes/archivosFoto'
import { ServiceError } from './errors'
import { SESSION_EXPIRED_MESSAGE } from './session'

/** Peso máximo que aceptan los dos buckets (US-01 y US-14: "350kb"). */
export const PESO_MAXIMO_FOTO_BYTES = 350 * 1024

/** Extensión (y `formato` para el back) según el tipo de la foto. Solo JPG y PNG. */
const EXTENSION_POR_TIPO: Record<string, 'jpg' | 'png'> = { 'image/jpeg': 'jpg', 'image/png': 'png' }

/** Una foto ya subida: lo que piden los endpoints del back más la ruta en el bucket (para borrarla si algo falla). */
export interface FotoEnStorage {
  url: string
  peso_kb: number
  formato: 'jpg' | 'png'
  /** Ruta dentro del bucket: `<auth.uid>/<uuid>.<ext>`. */
  path: string
}

/** Errores de la subida, con el texto que corresponde a cada pantalla. */
export interface MensajesSubida {
  /** La foto no es JPG/PNG o pesa más de 350 KB. */
  invalida: string
  /** Storage la rechazó o no respondió. */
  noSubida: string
}

/**
 * Sube una foto (data URL del formulario) al bucket y devuelve su URL pública.
 * @throws {ServiceError} `validation` con `mensajes.invalida` si no es JPG/PNG o pesa
 *   más de 350 KB; `unauthorized` sin sesión; `server` con `mensajes.noSubida` si
 *   Storage la rechaza o no responde.
 *
 * NOTA: se vuelve a validar tipo y peso aunque la pantalla ya lo hace: el bucket
 * rechaza lo que no cumple y es mejor avisarlo antes, en español.
 * NOTA: `upsert: false`: los buckets no tienen política de UPDATE y el nombre es
 * un uuid nuevo, así que nunca pisa otra foto.
 * NOTA: `peso_kb` se redondea hacia arriba (`Math.ceil`): el front deja hasta
 * 350 × 1024 bytes y el back rechaza `peso_kb > 350`, así coinciden.
 */
export async function subirFotoABucket(bucket: string, dataUrl: string, mensajes: MensajesSubida): Promise<FotoEnStorage> {
  const archivo = await (await fetch(dataUrl)).blob()
  const extension = EXTENSION_POR_TIPO[archivo.type]
  if (!extension || !TIPOS_FOTO_ACEPTADOS.includes(archivo.type) || archivo.size > PESO_MAXIMO_FOTO_BYTES) {
    throw new ServiceError('validation', mensajes.invalida)
  }

  const supabase = getSupabaseBrowserClient()
  const { data } = await supabase.auth.getSession()
  const authUserId = data.session?.user.id
  if (!authUserId) throw new ServiceError('unauthorized', SESSION_EXPIRED_MESSAGE)

  const path = `${authUserId}/${crypto.randomUUID()}.${extension}`
  const { error } = await supabase.storage.from(bucket).upload(path, archivo, { contentType: archivo.type, upsert: false })
  if (error) throw new ServiceError('server', mensajes.noSubida)

  const { data: publica } = supabase.storage.from(bucket).getPublicUrl(path)
  return { url: publica.publicUrl, peso_kb: Math.ceil(archivo.size / 1024), formato: extension, path }
}

/**
 * Sube varias fotos en paralelo, en el orden recibido. Si falla alguna, borra las
 * que sí subieron y tira el error: o suben todas o no queda ninguna.
 */
export async function subirFotosABucket(bucket: string, dataUrls: readonly string[], mensajes: MensajesSubida): Promise<FotoEnStorage[]> {
  const resultados = await Promise.allSettled(dataUrls.map((src) => subirFotoABucket(bucket, src, mensajes)))
  const subidas = resultados.flatMap((resultado) => (resultado.status === 'fulfilled' ? [resultado.value] : []))
  const fallo = resultados.find((resultado): resultado is PromiseRejectedResult => resultado.status === 'rejected')
  if (fallo) {
    await borrarFotosDeBucket(bucket, subidas.map((foto) => foto.path))
    throw fallo.reason instanceof ServiceError ? fallo.reason : new ServiceError('server', mensajes.noSubida)
  }
  return subidas
}

/**
 * Borra fotos ya subidas (cuando el alta o el registro no se completó), para no
 * dejar archivos sueltos en el bucket. Usa la política "borrar fotos propias".
 * NOTA: es un intento: si el borrado falla, se anota en la consola y no tapa el
 * error del alta, que es lo que la persona tiene que ver.
 * NOTA: para borrar, Storage exige permisos de DELETE **y SELECT** sobre
 * `storage.objects`. Sin la política de SELECT, `remove()` no borra nada y
 * tampoco devuelve error (responde una lista vacía): por eso se compara cuántos
 * borró. `fotos-propiedades` tiene la política "ver fotos propias" desde el 30/09.
 * TODO(db): `fotos-reclamos` no la tiene (relevado el 24/11): ver
 * `docs/HANDOFF-BACKEND.md` §7, US-14.
 */
export async function borrarFotosDeBucket(bucket: string, paths: readonly string[]): Promise<void> {
  if (paths.length === 0) return
  try {
    const { data, error } = await getSupabaseBrowserClient().storage.from(bucket).remove([...paths])
    if (error) console.warn(`No se pudieron borrar fotos sueltas de ${bucket}.`, error.message)
    else if ((data?.length ?? 0) < paths.length) {
      console.warn(`Se borraron ${data?.length ?? 0} de ${paths.length} fotos sueltas de ${bucket} (¿falta la política de SELECT del bucket?).`)
    }
  } catch (error) {
    console.warn(`No se pudieron borrar fotos sueltas de ${bucket}.`, error)
  }
}
