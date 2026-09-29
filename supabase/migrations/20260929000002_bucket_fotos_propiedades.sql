-- ============================================================================
-- Bucket de Storage "fotos-propiedades" (US-01 Registrar mis propiedades).
--
-- El bucket y sus dos políticas se crearon a mano desde el dashboard de
-- Supabase el 29/09/2026. Esta migración los VERSIONA SIN CAMBIARLOS: copia
-- exacta de la configuración leída de la base (storage.buckets y pg_policies
-- de storage.objects, solo lectura) el mismo día. Es idempotente: sobre la
-- base actual no cambia nada.
--
-- La agregó el equipo de front (rama feature/vistas) porque Ivan, que creó el
-- bucket, no estaba disponible. No se aplicó con esta migración: la base ya
-- tenía el bucket.
--
-- Qué hace el front con el bucket: sube cada foto del alta en
-- `<auth.uid()>/<archivo>`, con la sesión del usuario, y guarda la URL
-- pública (ver docs/HANDOFF-BACKEND.md §8).
--
-- Notas (NO se agregaron: habría que decidirlo aparte):
-- - No hay política de UPDATE. El front no hace upsert, así que no hace falta.
--   Si algún día se reemplaza una foto en el mismo path (upload con
--   `upsert: true`), esa subida fallaría.
-- - No hay política de SELECT. Las fotos se ven igual porque el bucket es
--   público (la URL pública no pasa por RLS); lo que no funcionaría es listar
--   la carpeta con la API de Storage (`list`), que el front no usa.
-- ============================================================================

-- Bucket: público, hasta 350 KB (358400 bytes), solo JPG y PNG.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos-propiedades', 'fotos-propiedades', true, 358400, array['image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- Subir: cualquier usuario autenticado, solo dentro de su carpeta (<auth.uid()>/...).
drop policy if exists "subir fotos propias" on storage.objects;
create policy "subir fotos propias"
  on storage.objects
  as permissive
  for insert
  to authenticated
  with check ((bucket_id = 'fotos-propiedades'::text) and ((storage.foldername(name))[1] = (auth.uid())::text));

-- Borrar: cualquier usuario autenticado, solo lo de su carpeta.
drop policy if exists "borrar fotos propias" on storage.objects;
create policy "borrar fotos propias"
  on storage.objects
  as permissive
  for delete
  to authenticated
  using ((bucket_id = 'fotos-propiedades'::text) and ((storage.foldername(name))[1] = (auth.uid())::text));
