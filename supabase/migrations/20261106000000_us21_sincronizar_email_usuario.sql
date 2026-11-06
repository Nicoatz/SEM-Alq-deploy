-- US-21 Modificar usuario: sincronizar usuario.email con auth.users.email.
--
-- El cambio de correo lo hace Supabase Auth desde el front (supabase.auth.updateUser):
-- manda el enlace de confirmación y, cuando el usuario lo confirma, actualiza SOLO
-- auth.users.email. Sin este trigger, la tabla usuario (que leen /usuarios/me y las
-- solicitudes) seguiría mostrando el correo viejo. Mientras no se confirme, auth.users.email
-- no cambia, así que "hasta entonces sigue vigente el anterior" se cumple solo.

CREATE OR REPLACE FUNCTION public.sincronizar_email_usuario()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- usuario.email es UNIQUE: si otro usuario ya tiene ese correo, el UPDATE falla (23505)
    -- y se revierte también el cambio en auth.users, que es lo correcto.
    UPDATE public.usuario
       SET email = lower(NEW.email)
     WHERE auth_user_id = NEW.id
       AND email IS DISTINCT FROM lower(NEW.email);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sincronizar_email_usuario ON auth.users;

CREATE TRIGGER trg_sincronizar_email_usuario
    AFTER UPDATE OF email ON auth.users
    FOR EACH ROW
    WHEN (OLD.email IS DISTINCT FROM NEW.email)
    EXECUTE FUNCTION public.sincronizar_email_usuario();
