# `lib/mocks` — el elenco único

Fuente de verdad: `docs/MapaDePantallas.pdf`, sección "El elenco y las propiedades". **Ninguna
pantalla ni service inventa su propio departamento, inquilino o monto: todo sale de acá.**

Solo lo importan los services (`src/services/*.service.ts`), en su rama mock. Como excepción
documentada, también el catálogo `/design-system` (no es una pantalla del producto).

## Las personas (`usuarios.mock.ts`)

| Id | Persona | Roles | Notas |
|---|---|---|---|
| `usr-nicolas` | Nicolás Arrieta | locador | Dueño de 7 propiedades: 4 alquiladas, 2 publicadas, 1 pausada. |
| `usr-sofia` | Sofía Ledesma | locador y locatario | Locataria de Obispo Trejo 1250 7° B y locadora de Mariano Moreno 285. Única cuenta con dos roles. |
| `usr-julieta` | Julieta Peralta | locatario | La que busca: encuentra Rondeau 480 y la solicita. |
| `usr-matias` | Matías Quiroga | locatario | **No está en el mapa** (Sprint 2, OK del PO). Postulante de Rondeau 480 y Fructuoso Rivera 785. No es inquilino de nada. |
| `usr-diego` | Diego Ferreyra | locatario | **No está en el mapa** (Sprint 2, OK del PO). Postulante; su solicitud de Fructuoso Rivera 785 está aceptada. No es inquilino de nada. |

Contraseña de las cinco en modo mock: `Rentar2026` (`MOCK_PASSWORD`). La cuenta admin del mapa no
está: el panel de administración no es de este sprint.

## Las propiedades (`propiedades.mock.ts`)

1. **Las del mapa** (8): las 7 de Nicolás y la de Sofía. **Todas tienen un título descriptivo,
   nunca la dirección** (US-41: el detalle público muestra el título en las migas y el subtítulo,
   y la zona pública nunca muestra la altura). Las alquiladas y la pausada usan "tipo de N
   dormitorios en barrio" (ej. "Departamento de 1 dormitorio en el Centro"). Las dos publicadas:
   - Rondeau 480, PB (Güemes): "1 dormitorio en planta baja con cochera". $385.000 + $62.000,
     disponible desde el 01/10/2026 (cuando empieza CT-2026-0207).
   - Fructuoso Rivera 785 (Cofico): "PH de 2 dormitorios con patio".
   - Las alquiladas y la pausada nunca aparecen en `/buscar`.
   - **Cada una tiene 3 fotos** (US-01 pide al menos 3), para que se puedan editar (US-03) sin
     subir fotos. Las dos extra salen del mismo banco (`src/assets/properties`): alguna se repite
     entre propiedades.
2. **Publicadas por otros locadores** (16, `ownerId: 'otros-locadores'`): las propiedades que antes
   eran de la landing. Conservan título, barrio, precio, dormitorios, m², índice, características y
   foto; se completaron dirección, expensas, descripción y disponibilidad. Todas publicadas, así
   `/buscar` tiene más de 10 resultados (US-34 pide paginar). Tres dicen "Monoambiente" en el título
   pero son `type: 'departamento'` de 1 dormitorio (así las muestra la landing); el filtro por tipo
   mira el campo `type`, nunca el título.

Todas están en Córdoba Capital (provincia "Córdoba", ciudad "Córdoba Capital").

## Reglas que no hay que volver a romper

1. Una propiedad `alquilada` o `pausada` nunca aparece en `/buscar`. Sí aparece una
   `alquilada_publicada` (alquilada, pero con fecha de "Disponible desde" cargada). Las alquiladas
   del elenco no tienen fecha: ninguna aparece en `/buscar`. En el alta, una alquilada con fecha
   queda `alquilada_publicada`.
2. Un inquilino pertenece a una sola propiedad; un monto, a un solo contrato.
3. Los montos futuros siempre llevan la palabra "estimado".
4. "Hoy" es el **23/09/2026** en todas las vistas (fijo en modo mock, ver `lib/utils/fechas.ts`).
5. Barrios válidos: los de `lib/catalogs/neighborhoods.ts`.
6. Prefijos de ID: propiedades `prop-…`, contratos `CT-2026-XXXX`, recibos `RC-2026-XXXX`,
   reclamos `RCL-2026-XXXX`, solicitudes `SOL-2026-XXXX`.

## Lo que se crea en el navegador

Las cuentas creadas en `/registro`, las propiedades creadas en el alta y las solicitudes enviadas
desde el detalle de una propiedad se guardan en `localStorage` (claves `rentar:mock:usuarios`,
`rentar:mock:propiedades` y `rentar:mock:solicitudes`), encima del elenco. El
botón "Reiniciar datos de prueba" de las herramientas de desarrollo las borra. Ver
`src/services/shared/mockStore.ts`.

Lo mismo con lo que se edita o se elimina (US-03, US-04, Sprint 2): una propiedad editada se guarda
entera en `rentar:mock:propiedades` y tapa a la del elenco; una eliminada se guarda con `deletedAt`
(**borrado lógico**: deja de verse en Mis propiedades, en `/buscar` y en su detalle, pero sus
solicitudes siguen mostrando la dirección) y sus solicitudes `pendiente` y `aceptada` pasan a
`cancelada`. "Reiniciar datos de prueba" deja todo como en el elenco.

## Los alquileres (`rental` en `propiedades.mock.ts` + `panel.mock.ts`)

Datos del export del listado del locador, confirmados por producto. El estado del pago y los
reclamos no se escriben en la propiedad: se calculan a partir de los cobros y reclamos de
`panel.mock.ts`, así el listado (US-02) y el panel nunca se contradicen.

| Propiedad | Locatario | Contrato | Septiembre | Reclamos abiertos | Próximo ajuste |
|---|---|---|---|---|---|
| Obispo Trejo 1250, 7° B | Sofía Ledesma | CT-2026-0148 | $435.800, pagado el 03/09 (al día) | 0 | ICL anual, 01/04/2027 |
| Laprida 340 | Tomás Bianchi | CT-2026-0102 | $520.000, vencido el 04/09 (retrasada) | 2 | ICL anual, 01/03/2027 |
| Belgrano 1120 | Julián Ferreyra | CT-2026-0115 | $460.000, vencido el 16/09 (retrasada) | 0 | IPC cada 4 meses, 01/11/2026 |
| Av. Colón 2450, 3° A | Martín Cabrera | CT-2026-0121 | $440.000, vence el 28/09 (con pago pendiente) | 1 | ICL anual, 01/10/2026 |
| Mariano Moreno 285 (de Sofía) | Camila Ríos | CT-2026-0133 | $510.000, vencido el 05/09 (retrasada) | 0 | IPC cada 4 meses, 01/12/2026 |

## Las solicitudes (`solicitudes.mock.ts`)

| Id | Postulante | Propiedad | Estado | Enviada | Respondida | Mensaje |
|---|---|---|---|---|---|---|
| SOL-2026-0031 | Julieta Peralta (`usr-julieta`) | Rondeau 480, PB | pendiente | 20/09/2026 | — | sin mensaje (el mapa no define uno) |
| SOL-2026-0032 | Matías Quiroga (`usr-matias`) | Rondeau 480, PB | pendiente | 19/09/2026 | — | sí |
| SOL-2026-0033 | Diego Ferreyra (`usr-diego`) | Rondeau 480, PB | rechazada | 02/09/2026 | 04/09/2026 | no |
| SOL-2026-0034 | Diego Ferreyra | Fructuoso Rivera 785 | **aceptada** | 12/09/2026 | 14/09/2026 | sí |
| SOL-2026-0035 | Matías Quiroga | Fructuoso Rivera 785 | cancelada (la canceló él) | 08/09/2026 | 10/09/2026 | no |
| SOL-2026-0036 | Julieta Peralta | Achával Rodríguez 245 (`prop-otro-05`, Güemes) | aceptada | 15/09/2026 | 21/09/2026 | no |
| SOL-2026-0037 | Julieta Peralta | 27 de Abril 370 (`prop-otro-03`, Centro) | rechazada | 05/09/2026 | 08/09/2026 | no |
| SOL-2026-0038 | Julieta Peralta | 24 de Septiembre 1450 (`prop-otro-07`, General Paz) | cancelada (la canceló ella) | 10/09/2026 | 12/09/2026 | no |

- SOL-2026-0031 muestra el estado "ya la solicitaste" del detalle (`/propiedad/prop-rondeau-480`
  con la sesión de Julieta). El envío completo (US-35) se prueba con Julieta sobre **Fructuoso
  Rivera 785** (`prop-rivera-785`), la otra publicada de Nicolás: Julieta no tiene ninguna ahí.
- **Solicitudes recibidas de Nicolás** (`/panel/solicitudes`): 5, en 2 propiedades. Pendientes 2
  (Julieta y Matías en Rondeau 480), aceptadas 1 (Diego en Fructuoso Rivera 785), cerradas 2.
- **Una sola aceptada por propiedad:** como Fructuoso Rivera 785 ya tiene la de Diego, si Julieta
  le manda una (el recorrido de la tanda 1), su "Aceptar" aparece deshabilitado hasta que Nicolás
  cancele la de Diego (US-38).
- **Mis solicitudes de Julieta** (`/panel/mis-solicitudes`): los cuatro estados (0031, 0036, 0037
  y 0038). Las tres de otros locadores no aparecen en el panel de nadie del elenco.
- **Contacto y legajo (US-35 actualizada, tanda 4 del Sprint 2):** las ocho tienen el contacto de su
  cuenta (teléfono en E.164) y un legajo. Julieta (0031 y 0036 a 0038): relación de dependencia,
  $1.250.000, 2 personas, sin mascotas, garantía propietaria. Matías (0032 y 0035): estudiante, no
  informa ingresos, 1 persona, seguro de caución. Diego: relación de dependencia (como dice su mensaje
  en 0034), garantía propietaria; en
  0033 (Rondeau), $900.000 y 1 persona; en 0034 (Fructuoso Rivera, apta mascotas), $950.000,
  2 personas y **un perro**: la única del elenco con mascotas, para probar ese bloque. Las enviadas
  desde el navegador antes de esta tanda se muestran "Sin datos de legajo".
- **Garantías que exige el locador:** Rondeau 480 pide garantía propietaria o seguro de caución
  (alcanza con una); Fructuoso Rivera 785 no pide ninguna. El alta todavía no carga este dato.
- **Postulantes nuevos (no están en el mapa):** Matías Quiroga (`matias.quiroga@rentar.test`) y
  Diego Ferreyra (`diego.ferreyra@rentar.test`), locatarios, contraseña `Rentar2026`. Se sumaron
  en la tanda 2 del Sprint 2 con el OK del PO, con nombres del diseño ("Flujo de solicitudes ·
  02"). No son inquilinos de ninguna propiedad. (Diego no tiene relación con Julián Ferreyra, el
  inquilino de Belgrano 1120.)
- Una propiedad alquilada (sin fecha) o pausada no recibe solicitudes.
- Las nuevas toman el siguiente número libre (`SOL-2026-0032`, …) y la fecha de "hoy" (23/09/2026)
  con la hora del momento.

Los "vence en N días" y "N días de atraso" se calculan contra "hoy" (`lib/utils/fechas.ts`), que
en modo mock está FIJO en el **23/09/2026**: Laprida lleva 19 días de atraso y Belgrano 7, siempre.
Con el backend real, "hoy" es la fecha del sistema. Cómo se calcula cada cifra del panel está
documentado en el encabezado de `panel.mock.ts`.

Lo que el export mostraba y **no** se usa porque contradice el elenco: Cerro de las Rosas, Villa
Belgrano, Bv. San Juan, Duarte Quirós, el tipo "Local", Familia Suárez, Tomás Bustos y Rocío
Medina. Tampoco se usa el banner de suscripción del export ("Locador Plus vence el 30/09"): la
suscripción no es de este sprint y el elenco no la define.

## Datos completados en el sprint 1

**No son datos del diseño ni del mapa.** Se completaron para que el panel y el listado de la tanda
"Locador" tuvieran algo coherente que mostrar, con el OK del PO. Si el mapa o el diseño definen
otros valores, ganan ellos.

| Dato | Valor elegido | Dónde |
|---|---|---|
| Ids de contrato | CT-2026-0102 (Laprida 340), CT-2026-0115 (Belgrano 1120), CT-2026-0121 (Av. Colón 2450), CT-2026-0133 (Mariano Moreno 285). CT-2026-0148 (Obispo Trejo) sí es del mapa. | `rental.contractId` en `propiedades.mock.ts` |
| Fechas de contrato | Laprida 01/03/2025–29/02/2028, Belgrano 01/07/2025–30/06/2028, Av. Colón 01/10/2025–30/09/2028, Mariano Moreno 01/12/2025–30/11/2028 (36 meses, a partir de su `publishedAt`) | `rental.startDate` / `endDate` |
| Vencimiento del cobro de septiembre | Laprida 04/09, Belgrano 16/09, Av. Colón 28/09, Obispo Trejo 10/09, Mariano Moreno 05/09. Elegidos para que, al 23/09, den los 19 y 7 días de atraso y el "vence este mes" pedidos. | `cobros` en `panel.mock.ts` |
| Fecha de pago de Obispo Trejo | 03/09 (al día) | `cobros` en `panel.mock.ts` |
| Próximos ajustes | Belgrano 01/11/2026 (IPC cada 4 meses), Av. Colón 01/10/2026 (ICL anual), Mariano Moreno 01/12/2026 (IPC cada 4 meses). Laprida (01/03/2027) y Obispo Trejo (01/04/2027) sí vinieron de producto y del mapa. | `rental.nextAdjustmentDate` |
| Reclamos | "Pérdida de agua en el baño" (abierto, sin responder) y "El termotanque no calienta" (en proceso) → Laprida 340; "Ruido de la bomba de agua" (en proceso) → Av. Colón 2450. Títulos del export del panel; ids RCL-2026-0036/0039/0041 y fechas elegidos acá. | `reclamos` en `panel.mock.ts` |
| Solicitud de Julieta | SOL-2026-0031, del 20/09/2026 | `solicitudes.mock.ts` |
| Solicitudes de la tanda 2 (Sprint 2) | SOL-2026-0032 a 0038: postulantes, estados, fechas y los dos mensajes, elegidos para cubrir los cuatro estados y la regla de una sola aceptada | `solicitudes.mock.ts` |
| Postulantes nuevos (Sprint 2) | Matías Quiroga y Diego Ferreyra, con su email, DNI, teléfono y fecha de nacimiento | `usuarios.mock.ts` |
| Contacto y legajo de SOL-2026-0031 a 0038 (Sprint 2, tanda 4) | Ocupación, ingresos, personas, mascotas y garantías de cada postulante (ver "Las solicitudes") | `solicitudes.mock.ts` |
| Garantías que exige Rondeau 480 (Sprint 2, tanda 4) | Propietaria o caución | `requiredGuarantees` en `propiedades.mock.ts` |
