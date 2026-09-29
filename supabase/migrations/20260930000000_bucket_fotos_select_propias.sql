-- ============================================================================
-- Política de SELECT del bucket "fotos-propiedades", solo en la carpeta propia.
--
-- Por qué: para borrar archivos (`storage.from(...).remove()`), Supabase
-- Storage exige permisos de DELETE **y SELECT** sobre `storage.objects`. El
-- bucket tenía solo INSERT ("subir fotos propias") y DELETE ("borrar fotos
-- propias") (ver 20260929000002_bucket_fotos_propiedades.sql), así que el
-- front no podía borrar las fotos de un alta que falla: `remove()` no borraba
-- nada y respondía una lista vacía, sin error (probado el 29/09).
--
-- Alcance: solo usuarios autenticados y solo su carpeta (`<auth.uid()>/`), la
-- misma condición que las otras dos políticas. No habilita listar ni leer lo
-- de otros usuarios. Las fotos se siguen viendo por su URL pública porque el
-- bucket es público (eso no pasa por RLS).
--
-- Idempotente: `drop policy if exists` + `create policy`. La agregó el equipo
-- de front (rama feature/vistas); la aplica el PO desde el SQL Editor.
-- ============================================================================

drop policy if exists "ver fotos propias" on storage.objects;
create policy "ver fotos propias"
  on storage.objects
  as permissive
  for select
  to authenticated
  using ((bucket_id = 'fotos-propiedades'::text) and ((storage.foldername(name))[1] = (auth.uid())::text));
