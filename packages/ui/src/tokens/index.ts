export { seed, colorScales, darkColorScales, typography, radii, spacing, shadows, zIndex, breakpoints, layout, motion } from './primitives'
export type { ColorScale } from './primitives'
export { light, dark } from './semantic'
export type { SemanticColorKey, SemanticColors } from './semantic'
// statusMeta importa @ant-design/icons (usa Context de React, no disponible
// en Server Components). Este barrel lo re-exporta para consumo normal
// desde componentes cliente, pero theme.ts (que sí usa el layout raíz, un
// Server Component) importa primitives/semantic directo, sin pasar por acá
// — ver el comentario en theme.ts.
export { statusMeta } from './status-meta'
export type { StatusMeta } from './status-meta'
