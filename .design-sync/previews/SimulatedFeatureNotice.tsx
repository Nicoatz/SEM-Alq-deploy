import { SimulatedFeatureNotice } from '@rentar/ui'

/** Aviso de función simulada — firma electrónica. */
export function Default() {
  return <SimulatedFeatureNotice feature="la firma electrónica" />
}

/** Con el motivo de la simulación (`reason`), como en el registro en modo real. */
export function ConMotivo() {
  return <SimulatedFeatureNotice feature="la confirmación por email" reason="El servidor todavía no envía emails de confirmación." />
}
