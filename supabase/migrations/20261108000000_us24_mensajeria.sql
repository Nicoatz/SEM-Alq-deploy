-- US-24: Envío de mensajes entre locador y locatario
-- Soporte para múltiples conversaciones temáticas y límite de 100 mensajes por conversación

CREATE TABLE IF NOT EXISTS public.conversacion (
    id SERIAL PRIMARY KEY,
    id_locador INTEGER NOT NULL REFERENCES public.usuario(id),
    id_locatario INTEGER NOT NULL REFERENCES public.usuario(id),
    iniciado_por INTEGER NOT NULL REFERENCES public.usuario(id),
    tipo_tema VARCHAR(50) NOT NULL DEFAULT 'general'
        CHECK (tipo_tema IN ('general', 'inmueble', 'reclamo', 'contrato')),
    asunto VARCHAR(150) NOT NULL,
    id_inmueble INTEGER REFERENCES public.inmueble(id) ON DELETE SET NULL,
    id_reclamo INTEGER REFERENCES public.reclamo(id) ON DELETE SET NULL,
    id_contrato INTEGER REFERENCES public.contrato(id) ON DELETE SET NULL,
    activo BOOLEAN NOT NULL DEFAULT true,
    fecha_creacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    fecha_actualizacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT chk_participantes_distintos CHECK (id_locador <> id_locatario),
    CONSTRAINT chk_iniciado_por_participante CHECK (iniciado_por IN (id_locador, id_locatario))
);

CREATE INDEX IF NOT EXISTS idx_conversacion_locador ON public.conversacion(id_locador);
CREATE INDEX IF NOT EXISTS idx_conversacion_locatario ON public.conversacion(id_locatario);
CREATE INDEX IF NOT EXISTS idx_conversacion_actualizacion ON public.conversacion(fecha_actualizacion DESC);

CREATE TABLE IF NOT EXISTS public.mensaje (
    id BIGSERIAL PRIMARY KEY,
    id_conversacion INTEGER NOT NULL REFERENCES public.conversacion(id) ON DELETE CASCADE,
    id_emisor INTEGER NOT NULL REFERENCES public.usuario(id),
    contenido TEXT NOT NULL CHECK (length(trim(contenido)) > 0),
    fecha_envio TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    eliminado BOOLEAN NOT NULL DEFAULT false,
    fecha_eliminacion TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_mensaje_conversacion_fecha 
    ON public.mensaje(id_conversacion, fecha_envio ASC);

-- Función y trigger para actualizar fecha de actividad y mantener hasta 100 mensajes por conversación (US-24)
CREATE OR REPLACE FUNCTION public.fn_mantener_limite_100_mensajes()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.conversacion
    SET fecha_actualizacion = NEW.fecha_envio
    WHERE id = NEW.id_conversacion;

    DELETE FROM public.mensaje
    WHERE id IN (
        SELECT id
        FROM public.mensaje
        WHERE id_conversacion = NEW.id_conversacion
        ORDER BY fecha_envio DESC, id DESC
        OFFSET 100
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_limite_100_mensajes ON public.mensaje;
CREATE TRIGGER trg_limite_100_mensajes
AFTER INSERT ON public.mensaje
FOR EACH ROW
EXECUTE FUNCTION public.fn_mantener_limite_100_mensajes();
