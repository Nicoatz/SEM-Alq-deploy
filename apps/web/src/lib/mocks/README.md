# `lib/mocks` — el elenco único

Fuente de verdad: `docs/MapaDePantallas.pdf`, sección "El elenco y las propiedades". **Ninguna
pantalla ni service inventa su propio departamento, inquilino o monto: todo sale de acá.**

Solo lo importan los services (`src/services/*.service.ts`), en su rama mock. Como excepción
documentada, también el catálogo `/design-system` (no es una pantalla del producto).

## Las personas (`usuarios.mock.ts`)

| Id | Persona | Roles | Notas |
|---|---|---|---|
| `usr-nicolas` | Nicolás Arrieta | locador y locatario | Dueño de 7 propiedades: 4 alquiladas, 2 publicadas, 1 pausada. Desde el Sprint 3 también locatario ("locador abarca a locatario", OK del PO): ve "Viendo como". |
| `usr-sofia` | Sofía Ledesma | locador y locatario | Locataria de Obispo Trejo 1250 7° B y locadora de Mariano Moreno 285. |
| `usr-julieta` | Julieta Peralta | locatario | La que busca: encuentra Rondeau 480, la solicita, se la aceptan y su contrato CT-2026-0207 está pendiente de firma (Sprint 3). |
| `usr-matias` | Matías Quiroga | locatario | **No está en el mapa** (Sprint 2, OK del PO). Postulante de Rondeau 480 y Fructuoso Rivera 785. No es inquilino de nada. |
| `usr-diego` | Diego Ferreyra | locatario | **No está en el mapa** (Sprint 2, OK del PO). Postulante; su solicitud de Fructuoso Rivera 785 está aceptada. No es inquilino de nada. **Sin teléfono** (Sprint 3): el caso "Sin cargar" de US-20. Por eso el detalle de un contrato con Diego como locatario muestra "Teléfono: Sin dato": el teléfono sale del perfil, y el que carga en una solicitud es otro dato. |
| `usr-camila` | Camila Ríos | locatario | Inquilina de Mariano Moreno 285 (de Sofía). **Cuenta desde la tanda 4 del Sprint 3** (OK del PO; en el mapa ya estaba, sin cuenta): `camila.rios@rentar.test`. Tiene un vigente (CT-2026-0133) y un finalizado (CT-2023-0041): el caso de "Mis alquileres" (US-27). |

Contraseña de las seis en modo mock: `Rentar2026` (`MOCK_PASSWORD`). La cuenta admin del mapa no
está: el panel de administración no es de este sprint.

## El perfil (US-20 y US-21)

Sale de `usuarios.mock.ts`. El legajo del perfil (`perfiles.mock.ts`) se sacó el 09/11: salió de
US-20 y US-21 el 06/11. El legajo de cada **solicitud** (US-35) sigue en `solicitudes.mock.ts`.

| Id | Nombre, apellido y DNI |
|---|---|
| `usr-nicolas` | **Bloqueados**: es locador de contratos vigentes (CT-2026-0102). |
| `usr-sofia` | **Bloqueados**: locataria de CT-2026-0148. |
| `usr-julieta` | **Bloqueados** desde la tanda 2 del Sprint 3: locataria de CT-2026-0207, pendiente de firma. |
| `usr-matias` | Editables. **Ejemplo de edición** (con Diego). |
| `usr-diego` | Editables. Sin teléfono. **Ejemplo de edición** (con Matías). |
| `usr-camila` | **Bloqueados**: locataria de CT-2026-0133, vigente. |

- El bloqueo no se guarda: sale de los contratos vigentes o pendientes de firma en los que la cuenta
  es dueña o locataria, mirando `propiedades.mock.ts` (`rental`) y `contratos.mock.ts` (más los del
  navegador). Lo resuelve `services/adapters/contrato-mock.adapter.ts#contratoActivoDeUsuarioMock`.
- **Ejemplos de edición de la tanda 1 → Matías y Diego.** Julieta era el ejemplo de "editable", pero
  desde que su contrato está pendiente de firma su nombre, apellido y DNI están bloqueados (US-21).
- Lo que se edita en "Mi perfil" se guarda en `rentar:mock:usuarios` (nombre, apellido, correo,
  teléfono, fecha y contraseña). El correo nuevo vale en el momento, también para entrar (igual que
  el back desde el 06/11). **El DNI editado no se guarda en el navegador**: vive en memoria hasta
  recargar (ver `services/perfil.service.ts`).

## Los contratos (`contratos.mock.ts`, US-05, Sprint 3 tanda 2)

Dos fuentes, sin duplicar: los **5 vigentes** salen de `propiedades.mock.ts` (`rental`, ver "Los
alquileres") y el resto, de `contratos.mock.ts` más los borradores del navegador
(`rentar:mock:contratos`).

| Código | Propiedad | Locatario | Estado | Vigencia | Monto | Ajuste | De dónde sale |
|---|---|---|---|---|---|---|---|
| CT-2026-0102 | Laprida 340 | Tomás Bianchi | vigente | 01/03/2025 → 29/02/2028 | $520.000 | ver "Los alquileres" | `rental` |
| CT-2026-0115 | Belgrano 1120 | Julián Ferreyra | vigente | 01/07/2025 → 30/06/2028 | $460.000 | ver "Los alquileres" | `rental` |
| CT-2026-0121 | Colón 2450 | Martín Cabrera | vigente | 01/10/2025 → 30/09/2028 | $440.000 | ver "Los alquileres" | `rental` |
| CT-2026-0148 | Obispo Trejo 1250, 7° B | Sofía Ledesma | vigente | 01/04/2026 → 31/03/2029 | $470.000 | ver "Los alquileres" | `rental` |
| CT-2026-0133 | Mariano Moreno 285 (de **Sofía**) | Camila Ríos | vigente | 01/12/2025 → 30/11/2028 | $510.000 | ver "Los alquileres" | `rental` |
| **CT-2026-0207** | Rondeau 480, PB | Julieta Peralta | **pendiente de firma** | 01/10/2026 → 30/09/2029 | $385.000 | ICL semestral (5 ajustes, el primero el 01/04/2027) | `contratos.mock.ts`, desde SOL-2026-0031 |
| **BOR-2026-0001** | Chacabuco 690 | Matías Quiroga | **borrador**, sin código | 01/10/2026, 24 meses | $445.000 | Sin ajuste | `contratos.mock.ts` |
| **CT-2024-0031** | Chacabuco 690 | Valentina Ríos | **finalizado** | 01/03/2024 → 29/02/2026 (24 meses) | $415.000 | Sin ajuste | `contratos.mock.ts` |
| **CT-2023-0041** | Rondeau 480, PB | Camila Ríos | **finalizado** | 01/12/2023 → 30/11/2025 (24 meses) | $240.000 | IPC semestral | `contratos.mock.ts` |

- **CT-2026-0207** tiene un garante, Hugo Peralta (DNI 14.902.338, `hugo.peralta@rentar.test`, del
  diseño). Mientras está pendiente de firma, **Rondeau 480 sigue publicada** (decisión del PO). Su
  monto es el canónico del mapa ($385.000; el wizard del diseño decía $320.000).
- **Firmas (US-07, firma con DocuSign, Sprint 5):** firman el locador, el locatario **y cada
  garante** (decisión del PO del 11/11). CT-2026-0207 arranca **pendiente con 0 de 3 firmas**
  (Nicolás, Julieta y Hugo). Nicolás firma desde el detalle (`/panel/contratos/CT-2026-0207`) y
  Julieta desde **Mi alquiler** (`/panel/alquiler`). No hay "Reenviar invitación".
- **DocuSign simulado (`/simulador-firma`, solo con mocks):** "Ir a firmar" lleva a una pantalla que
  reemplaza a DocuSign, con los datos en el fragmento de la URL (`#…`, nunca en `localStorage`). Ahí se
  elige **Firmar**, **Declinar**, **Cerrar sin firmar** (`cancel`) o **Dejar vencer la sesión**
  (`session_timeout`); después vuelve a la ficha con `?event=…`, como DocuSign.
- **Firmas diferidas:** Firmar y Declinar no se registran en el momento: quedan en
  `rentar:mock:firmas-diferidas` (contrato, firmante y desde cuándo, sin URLs ni tokens) y se aplican
  **8 segundos después** (o **60** con "Simular un aviso demorado"), cuando alguna pantalla vuelve a
  leer los contratos. Así se ve "Estamos registrando tu firma…" y, con 60 s, "Todavía estamos
  registrando tu firma" (la espera corta a los 45 s). Usan el reloj real, no el "hoy" del elenco.
- **Enlace del garante (Tanda B):** el locador genera el enlace de cada garante desde el detalle
  ("Generar enlace"). En `rentar:mock:contratos` se guarda solo el **hash SHA-256** del token y su
  vencimiento (**48 h**, con el reloj del mock), nunca el token ni la URL. Un enlace nuevo anula el
  anterior; firmar o volver a borrador también lo anulan. Un enlace inexistente, vencido o anulado
  muestra siempre "Este enlace no es válido o ya no está disponible.". El garante firma en
  `/firma-garante/<token>` y pasa por el mismo simulador (firma diferida de 8 s, o Declinar).
- **Rechazar** (las dos partes, mientras no hayan firmado) o **Declinar** en el simulador: el contrato
  vuelve a **borrador**, conserva el código y se borran todas las firmas, como en el back. El locador
  sigue en el alta (`/editar?envio=rechazado`); el locatario deja de verlo ("Rechazaste el contrato").
- Cuando firman todos, Rondeau 480 pasa a **alquilada** (sale de `/buscar`), sus solicitudes
  pendientes (0032 de Matías y 0040 de Diego) pasan a **rechazadas** con "La propiedad ya fue
  alquilada." y el documento se muestra como **`CT-2026-0207-firmado.pdf`** (el mismo PDF ficticio),
  con el aviso de firma de prueba.
- Los contratos guardados en el navegador antes del 11/11 (sin garantes en `firmas`) se leen con los
  garantes pendientes: no hace falta reiniciar. "Reiniciar datos de prueba" deja todo como al principio.

**Cerrar CT-2026-0207 en mock, paso por paso** (para Selenium). Las cuentas son las del elenco
(`usuarios.mock.ts`), con la contraseña del elenco (`CLAUDE.md`). Arrancar con "Reiniciar datos de
prueba". Cada firma se registra **8 segundos** después de volver del simulador: esperar a que se vea
`contrato-regreso-confirmado` (o `firma-garante-listo`) antes de seguir.

1. **Locador.** Entrar como Nicolás e ir a `/panel/contratos/CT-2026-0207`. En `contrato-firma-visor`,
   pasar las páginas con `contrato-firma-visor-siguiente` hasta la última (6), marcar
   `contrato-firma-acepto`, tocar `contrato-firma-firmar` y confirmar (`confirm-action-ok`). En el
   simulador, `simulador-firma-firmar`. Vuelve al detalle: `contrato-regreso-esperando` y, a los 8 s,
   `contrato-regreso-confirmado`. Faltan 2 de 3.
2. **Locatario.** Cerrar la sesión (o borrar la cookie `rentar_session`, sin tocar `localStorage`),
   entrar como Julieta e ir a `/panel/alquiler`. Los mismos pasos que el locador. Faltan 1 de 3.
3. **Enlace de Hugo.** Entrar otra vez como Nicolás, abrir `/panel/contratos/CT-2026-0207` y, en la
   fila del garante (`contrato-firmante` con `data-rol="garante"`), tocar
   `contrato-garante-enlace-generar`. Leer la URL de `contrato-garante-enlace-url` (y el vencimiento en
   `contrato-garante-enlace-vence`) y cerrar con `contrato-garante-enlace-listo`. La URL no se vuelve a
   mostrar.
4. **Firma de Hugo.** Abrir esa URL (no hace falta cerrar la sesión: la página es pública). En
   `firma-garante-datos`, marcar `firma-garante-acepto`, tocar `firma-garante-firmar` y confirmar
   (`confirm-action-ok`). En el simulador, `simulador-firma-firmar`. Vuelve a `/firma-garante/<token>`
   con `firma-garante-listo`.
5. **Verificar** (8 s después): en `/panel/contratos/CT-2026-0207`, `contrato-detalle` con
   `data-estado="vigente"`, `contrato-firmado-todas`, "Documento firmado" con
   `CT-2026-0207-firmado.pdf` y `contrato-documento-aviso-prueba`. Rondeau 480 aparece **alquilada** en
   Mis propiedades y ya no está en `/buscar`. Abrir otra vez el enlace de Hugo: `firma-garante-invalido`.
- Los **5 vigentes** y CT-2023-0041 son anteriores a RentAR: su detalle no tiene firmas registradas
  (no se inventan).
- **CT-2023-0041:** Camila Ríos queda con un vigente (0133) y un finalizado: el caso de "dos o más
  contratos" de US-27. Desde la tanda 4 tiene cuenta (`usr-camila`), así que Mis alquileres
  (`/panel/alquileres`) se prueba entrando como ella.
  Termina el 30/11/2025, el día antes de que empiece 0133: un inquilino pertenece a una sola
  propiedad a la vez (mapa; PO, tanda 3 del Sprint 3).
- **CT-2026-0161, la excepción de esa regla (PO, 05/11):** Camila tiene un segundo vigente en Ituzaingó 870,
  4° C, de Sofía Ledesma: $420.000, "Sin ajuste", del 01/05/2026 al 30/04/2028, vence a los 27 días. Es el caso
  de dos contratos de US-12 y el "Sin ajuste" de US-11. Solo Camila tiene dos vigentes.
- **PDF del elenco:** todos usan `apps/web/public/mocks/contrato-ficticio.pdf`: 6 páginas, 7 KB, sin datos
  reales. Lo que se sube en el alta se ve hasta recargar: el archivo no entra en `localStorage`, y después
  se muestra el ficticio. Las listas y el alta siguen mostrando el nombre y el tamaño guardados; el visor
  dice "contrato-ficticio.pdf (ejemplo)" y muestra el aviso `visor-pdf-aviso-demo`. BOR-2026-0001 no tiene
  PDF: está en el paso 2.
- **Vencimiento:** es un **plazo en días** desde el inicio del período, no el día del mes (US-05). Vale
  igual para Mi alquiler y para cobros (`PLAZO_POR_CONTRATO` en `periodos.mock.ts`): Laprida 3, Belgrano 15,
  Av. Colón 27, Mariano Moreno 4, Obispo Trejo 10 e Ituzaingó 27. Con Obispo Trejo, el 23/09 el próximo vencimiento es el
  **11/10**. En real se muestra lo que manda el back: la diferencia es S4-2 de HANDOFF §7.
- **Cobros (US-08, US-09 y US-10):** `periodos.mock.ts` tiene agosto (cobrado), septiembre y octubre (futuro:
  no se muestra) de los 6 vigentes, con 0,5 % diario y 5 días de gracia. Los ids son `PER-0102-2026-09`; los
  comprobantes, `RC-AAAA-NNNN`. Al 23/09, Nicolás tiene dos vencidos, uno pendiente y uno pagado en septiembre.
  "Vencido" da $1.021.000 en `/panel` y en `/panel/cobros`: los dos leen estos períodos y suman la mora (el
  alquiler solo serían $980.000). "Total del mes" sigue en $1.890.000: es lo pactado, sin mora. Lo que se
  registra va a `rentar:mock:cobros` y también cambia el panel y Mis propiedades (US-02): los tres leen estos
  períodos. Un contrato que queda vigente en la sesión genera sus períodos, como el trigger del back: uno por mes
  hasta el fin, y el primero arranca el día de inicio (`periodosDeContrato`). CT-2026-0133 tiene además diciembre de 2025, para el filtro por año de Mis pagos.
  Camila, al 23/09: Mariano Moreno vencido ($543.150, 13 días de mora) e Ituzaingó pendiente ($420.000).
- **Fecha simulada:** con `rentar:mock:hoy` = `AAAA-MM-DD` en `localStorage`, `ahora()` usa esa fecha. Sirve
  para probar las variantes de la tarjeta de US-12. "Reiniciar datos de prueba" la borra.
- **Pestaña Contratos (US-43):** no hay listado global: cada propiedad muestra los suyos en
  `/panel/propiedades/[id]?tab=contratos`. Rondeau 480: pendiente + un anterior. Fructuoso Rivera:
  sin contrato, con la aceptada 0034. Chacabuco 690: borrador + un anterior.
- **CT-2024-0031 (Valentina Ríos):** contrato **histórico sin cuenta** (`tenantUserId: null`), nombre
  tomado del diseño. Es el detalle "Sin ajuste", sin calendario (US-42). No aparece en ningún Mis alquileres.
- **"Sin contrato y sin aceptada" no está sembrado:** ninguna propiedad del elenco lo cubre. Se arma en la
  prueba: Nicolás cancela la aceptada 0034 de Fructuoso Rivera (US-38) y queda solo la pendiente 0039.
- **"Iniciar contrato"** se prueba con **SOL-2026-0034** (Diego, Fructuoso Rivera 785): aceptada y
  sin contrato. Crea el borrador al entrar, como el back: si salís sin guardar, queda en la pestaña. SOL-2026-0031 ya originó CT-2026-0207: muestra el estado del contrato, no el botón.
- **Id `BOR-<n>` de los contratos creados en el navegador:** es interno y se mantiene después de enviar a
  firmar. Por eso la ruta sigue siendo `/panel/contratos/BOR-<n>` aunque el contrato ya tenga código
  (`CT-AAAA-NNNN`). El mock lo encuentra por id o por código. En real no existe: el id es el de la fila en
  la base, que no cambia de borrador a vigente (por ejemplo, `/panel/contratos/34`).
- **Borrador sembrado: BOR-2026-0001** (Chacabuco 690, desde SOL-2026-0041 de Matías). Chacabuco sigue
  **pausada**: el locador la pausó mientras arma el contrato, y no aparece en `/buscar`. Eliminarlo lo
  marca `descartado` en el navegador y la solicitud **vuelve a pendiente**, como en el back (decisión del
  PO, 05/11): para iniciar otro contrato hay que aceptarla de nuevo. "Reiniciar datos de prueba" trae
  los dos de vuelta. Matías tiene además la 0032 pendiente en
  Rondeau: la regla de una sola activa es por propiedad (US-35).
- Los borradores se guardan en `rentar:mock:contratos` **sin el DNI de los garantes**, que vive en
  memoria hasta recargar (mismo criterio que la tanda 1); al recargar, el borrador pide el DNI de nuevo.
- **Pendiente (issue #15, regla de la tanda 5 del Sprint 2):** "mientras el inmueble tenga una
  solicitud aceptada, sigue publicado pero no recibe solicitudes nuevas". **El mock todavía no la
  aplica:** con SOL-2026-0031 aceptada, Rondeau 480 sigue recibiendo solicitudes nuevas
  (`solicitudes.service#propiedadSolicitableMock` solo mira el estado de la propiedad).

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

## Excepciones del elenco final

- **Camila Ríos tiene dos contratos vigentes** (Mariano Moreno 285 e Ituzaingó 870, 4° C): es la única excepción a
  "un inquilino pertenece a una sola propiedad a la vez" (PO, 05/11).
- **Valentina Ríos** es un contrato histórico sin cuenta (CT-2024-0031).
- **Chacabuco 690** está pausada, con el borrador BOR-2026-0001 y un contrato anterior.
- **Sofía Ledesma paga $470.000**, sin extraordinarias. El panel de Nicolás da $470.000 de $1.890.000.

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

## Los alquileres (`rental` en `propiedades.mock.ts` + `periodos.mock.ts`)

Datos del export del listado del locador, confirmados por producto. El estado del pago y los
reclamos no se escriben en la propiedad: se calculan a partir de los períodos de `periodos.mock.ts`
y los reclamos de `panel.mock.ts`, así el listado (US-02), el panel y cobros nunca se contradicen.

| Propiedad | Locatario | Contrato | Septiembre | Reclamos abiertos | Próximo ajuste |
|---|---|---|---|---|---|
| Obispo Trejo 1250, 7° B | Sofía Ledesma | CT-2026-0148 | $470.000, pagado el 03/09 (al día) | 0 | ICL anual, 01/04/2027 |
| Laprida 340 | Tomás Bianchi | CT-2026-0102 | $520.000, vencido el 04/09 (retrasada) | 2 | ICL anual, 01/03/2027 |
| Belgrano 1120 | Julián Ferreyra | CT-2026-0115 | $460.000, vencido el 16/09 (retrasada) | 0 | IPC cada 4 meses, 01/11/2026 |
| Av. Colón 2450, 3° A | Martín Cabrera | CT-2026-0121 | $440.000, vence el 28/09 (con pago pendiente) | 1 | ICL anual, 01/10/2026 |
| Mariano Moreno 285 (de Sofía) | Camila Ríos | CT-2026-0133 | $510.000, vencido el 05/09 (retrasada) | 0 | IPC cada 4 meses, 01/12/2026 |

**Depósito y garantes (US-27, tanda 4 del Sprint 3, pedido del PO):** solo en CT-2026-0148 y
CT-2026-0133, para la ficha del locatario. Un mes de depósito (`depositMonths` × el precio de la
publicación: $470.000 y $510.000) y un garante cada uno, con nombres que no son del elenco: **Raúl
Benítez** (de Sofía) e **Inés Moyano** (de Camila). Los otros tres vigentes (0102, 0115 y 0121) no los
tienen y su detalle muestra "Sin dato": no rompe nada (ninguno tiene locatario con cuenta). El día de
pago de los vigentes sale de `PLAZO_POR_CONTRATO` (`periodos.mock.ts`).

## Las solicitudes (`solicitudes.mock.ts`)

| Id | Postulante | Propiedad | Estado | Enviada | Respondida | Mensaje |
|---|---|---|---|---|---|---|
| SOL-2026-0031 | Julieta Peralta (`usr-julieta`) | Rondeau 480, PB | **aceptada** (Sprint 3, originó CT-2026-0207) | 20/09/2026 | 21/09/2026 | sin mensaje (el mapa no define uno) |
| SOL-2026-0032 | Matías Quiroga (`usr-matias`) | Rondeau 480, PB | pendiente | 19/09/2026 | — | sí |
| SOL-2026-0033 | Diego Ferreyra (`usr-diego`) | Rondeau 480, PB | rechazada | 02/09/2026 | 04/09/2026 | no |
| SOL-2026-0034 | Diego Ferreyra | Fructuoso Rivera 785 | **aceptada** | 12/09/2026 | 14/09/2026 | sí |
| SOL-2026-0035 | Matías Quiroga | Fructuoso Rivera 785 | cancelada (la canceló él) | 08/09/2026 | 10/09/2026 | no |
| SOL-2026-0036 | Julieta Peralta | Achával Rodríguez 245 (`prop-otro-05`, Güemes) | aceptada | 15/09/2026 | 21/09/2026 | no |
| SOL-2026-0037 | Julieta Peralta | 27 de Abril 370 (`prop-otro-03`, Centro) | rechazada | 05/09/2026 | 08/09/2026 | no |
| SOL-2026-0038 | Julieta Peralta | 24 de Septiembre 1450 (`prop-otro-07`, General Paz) | cancelada (la canceló ella) | 10/09/2026 | 12/09/2026 | no |

- SOL-2026-0031 muestra el estado "ya la solicitaste" (aceptada desde el Sprint 3) del detalle
  (`/propiedad/prop-rondeau-480` con la sesión de Julieta). El envío completo (US-35) se prueba con Julieta sobre **Fructuoso
  Rivera 785** (`prop-rivera-785`), la otra publicada de Nicolás: Julieta no tiene ninguna ahí.
- **Solicitudes recibidas de Nicolás** (`/panel/solicitudes`): 7, en 2 propiedades. Desde el
  Sprint 3 (tanda 2): pendientes 3 (Matías y Diego en Rondeau 480; Sofía en Fructuoso Rivera 785),
  aceptadas 2 (Julieta en Rondeau 480, con contrato; Diego en Fructuoso Rivera 785, sin contrato),
  cerradas 2. Como Rondeau ya tiene una aceptada, ahí no se puede aceptar otra.
- **Tiempo en horas (US-36, tanda C de correcciones del Sprint 2):** desde la tanda 3 del Sprint 3
  hay **un solo reloj** (`lib/utils/fechas.ts#ahora`): en mock, la fecha es el 23/09/2026 y la hora,
  la real (`hoy()` es esa fecha a las 00:00). 0039 (Sofía en Fructuoso Rivera 785) y 0040 (Diego
  vuelve a solicitar Rondeau 480 después del rechazo de la 0033) tienen su fecha **relativa a
  `ahora()`** (ahora − 3 h y ahora − 30 min, calculadas al leerlas): siempre dicen "hace 3 h" y "hace
  menos de 1 h", a cualquier hora. La de Matías (0032, 19/09) tiene fecha fija y dice "hace 3 días". Sofía ofrece tres garantías y Diego, dos, para el resumen de la fila.
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
- Las nuevas toman el siguiente número libre (`SOL-2026-0041`, …) y el "ahora" del elenco
  (23/09/2026 a las 12:00): dicen "hace menos de 1 h".

Los "vence en N días" y "N días de atraso" se calculan contra "hoy" (`lib/utils/fechas.ts`), que
en modo mock está FIJO en el **23/09/2026**: Laprida lleva 19 días de atraso y Belgrano 7, siempre.
Con el backend real, "hoy" es la fecha del sistema. Las cifras de cobros del panel salen de
`lib/cobros/resumenPanel.ts`.

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
| Vencimiento del cobro de septiembre | Laprida 04/09, Belgrano 16/09, Av. Colón 28/09, Obispo Trejo 11/09, Mariano Moreno 05/09. Elegidos para que, al 23/09, den los 19 y 7 días de atraso y el "vence este mes" pedidos. | `cobros` en `panel.mock.ts` |
| Fecha de pago de Obispo Trejo | 03/09 (al día) | `cobrosDePeriodos` en `periodos.mock.ts` |
| Próximos ajustes | Belgrano 01/11/2026 (IPC cada 4 meses), Av. Colón 01/10/2026 (ICL anual), Mariano Moreno 01/12/2026 (IPC cada 4 meses). Laprida (01/03/2027) y Obispo Trejo (01/04/2027) sí vinieron de producto y del mapa. | `rental.nextAdjustmentDate` |
| Reclamos | "Pérdida de agua en el baño" (abierto, sin responder) y "El termotanque no calienta" (en proceso) → Laprida 340; "Ruido de la bomba de agua" (en proceso) → Av. Colón 2450. Títulos del export del panel; ids RCL-2026-0036/0039/0041 y fechas elegidos acá. | `reclamos` en `panel.mock.ts` |
| Solicitud de Julieta | SOL-2026-0031, del 20/09/2026 | `solicitudes.mock.ts` |
| Solicitudes de la tanda 2 (Sprint 2) | SOL-2026-0032 a 0038: postulantes, estados, fechas y los dos mensajes, elegidos para cubrir los cuatro estados y la regla de una sola aceptada | `solicitudes.mock.ts` |
| Postulantes nuevos (Sprint 2) | Matías Quiroga y Diego Ferreyra, con su email, DNI, teléfono y fecha de nacimiento | `usuarios.mock.ts` |
| Contacto y legajo de SOL-2026-0031 a 0038 (Sprint 2, tanda 4) | Ocupación, ingresos, personas, mascotas y garantías de cada postulante (ver "Las solicitudes") | `solicitudes.mock.ts` |
| Garantías que exige Rondeau 480 (Sprint 2, tanda 4) | Propietaria o caución | `requiredGuarantees` en `propiedades.mock.ts` |
