/**
 * index.ts — barrel del elenco único de mocks.
 *
 * Qué es: re-exporta los mocks de este directorio para que `services/`
 * importe desde un solo lugar (`@/lib/mocks`). Ver `README.md` para las
 * reglas del elenco. Solo lo importan los services (y, como excepción
 * documentada, el catálogo `/design-system`).
 */
export { usuarios, MOCK_PASSWORD, type UsuarioMock } from './usuarios.mock'
export { propiedades, type PropiedadMock, type FotoMock, type AlquilerMock } from './propiedades.mock'
export { cobros, reclamos, type CobroMock, type ReclamoMock } from './panel.mock'
export { solicitudes, type SolicitudMock } from './solicitudes.mock'
