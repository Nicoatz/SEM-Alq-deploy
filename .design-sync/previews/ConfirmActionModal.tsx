import { ConfirmActionModal } from '@rentar/ui'

/**
 * `getContainer={false}` monta el modal de antd inline, en vez de portarlo a
 * `document.body` — así queda dentro de la card en vez de flotar fuera de
 * ella. No es parte del tipo público de `ConfirmActionModalProps` (solo pasa
 * a través de `...rest`), pero el `Modal` de antd sí lo acepta en runtime.
 *
 * `.ant-modal-wrap` sigue siendo `position: fixed; inset: 0`, así que
 * necesita un ancestro que le dé un "containing block" con alto real — la
 * card de `/design-sync` envuelve cada story en un `transform` (para el
 * aislamiento visual), y eso ya alcanza para que `position: fixed` deje de
 * medir contra el viewport y pase a medir contra ese ancestro (CSS: un
 * `transform` en un ancestro crea containing block para descendientes
 * fixed). Sin darle alto explícito a este wrapper, ese ancestro queda con
 * alto 0 (nada en flujo normal lo fuerza) y el modal se ve "vacío" aunque
 * el DOM esté ahí. `height: 360px` es ese alto explícito.
 */
const wrapStyle = { position: 'relative' as const, height: 360 }
const inline = { getContainer: false } as Record<string, unknown>

/** Confirmación neutra — pausar una propiedad. */
export function Default() {
  return (
    <div style={wrapStyle}>
      <ConfirmActionModal
        {...inline}
        open
        title="¿Pausar esta propiedad?"
        description="Dejará de aparecer en las búsquedas hasta que la vuelvas a publicar."
        confirmLabel="Pausar"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    </div>
  )
}

/** Confirmación destructiva — eliminar una propiedad. */
export function Destructiva() {
  return (
    <div style={wrapStyle}>
      <ConfirmActionModal
        {...inline}
        open
        title="¿Eliminar esta propiedad?"
        description="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        danger
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    </div>
  )
}

/**
 * Con cuerpo extra (`children`) y la acción en curso (`confirmLoading`):
 * aceptar una solicitud ("Flujo de solicitudes" · 03).
 */
export function ConCuerpoYCarga() {
  return (
    <div style={wrapStyle}>
      <ConfirmActionModal
        {...inline}
        open
        title="¿Aceptar la solicitud de Julieta Peralta?"
        description="Le avisamos por mail. Vas a poder ver sus datos de contacto."
        confirmLabel="Aceptar solicitud"
        confirmLoading
        onConfirm={() => {}}
        onCancel={() => {}}
      >
        <p style={{ margin: 0 }}>La otra solicitud por Rondeau 480 sigue pendiente.</p>
      </ConfirmActionModal>
    </div>
  )
}

/**
 * Aviso sin nada que elegir (`hideCancel`): solo "Entendido". La cruz y
 * Escape siguen cerrando ("Detalle de propiedad del locador" · 05).
 */
export function AvisoSinCancelar() {
  return (
    <div style={wrapStyle}>
      <ConfirmActionModal
        {...inline}
        open
        title="No podés eliminar esta propiedad"
        description="Tiene un contrato vigente. Vas a poder eliminarla cuando el contrato termine."
        confirmLabel="Entendido"
        hideCancel
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    </div>
  )
}
