# Notas de `/design-sync` — @rentar/ui

## Fuente de verdad: este repo (desde 2026-09-23)

El frontend de RentAR se mudó al repo del equipo (`SEM-Alq`, rama `feature/vistas` → `develop`).
**Desde ahora, `/design-sync` se corre solo desde este repo.** El repo anterior
(`LandingSeminario/versionCompleta`) queda como histórico: no se sincroniza más desde ahí, así
no hay dos fuentes empujando versiones distintas de `@rentar/ui` al mismo proyecto de Claude Design.

Cambios de `@rentar/ui` hechos en la migración, a tener en cuenta en el próximo sync:
- `Header`/`Footer`: los botones y links apuntan a rutas reales (`/login`, `/buscar`,
  `/panel/propiedades/nueva`); el link a `/design-system` solo aparece en desarrollo. Sin cambios
  visuales.
- `RoleSwitcher`: ahora es una pestaña plegable al borde izquierdo, con `role`/`onChange` opcionales
  y el botón "Reiniciar datos de prueba" (`onResetMockData`).
- `PropertyCard`: etiqueta para el tipo nuevo `monoambiente`.
- `.ds-sync/` se copió sin `node_modules` y sigue en el `.gitignore` (se regenera en cada sync).

Cambios de la tanda 2 (autenticación), **pendientes de subir** con `/design-sync` al final del
Sprint 1 (con aprobación del PO), para que Claude Design quede alineado:
- **Nuevo: `PasswordStrengthMeter`** (`components/forms/`): barra de 4 segmentos, etiqueta
  "Fuerza: …" y checklist. Lo pedía "Autenticación" · 03 como componente nuevo. Solo muestra: el nivel
  y los requisitos los calcula `apps/web`. Sin "Un símbolo": el back no acepta símbolos.
- `UserMenu` ("Mi perfil y legajo" · 02): cabecera del menú desplegado (avatar con iniciales, nombre
  y `subtitle`), contador opcional por ítem (`badgeCount`), separador antes de "Cerrar sesión" y,
  debajo de 768px, hoja desde abajo en vez de dropdown. Props nuevas opcionales: la API anterior
  sigue funcionando.
- `AppShell`: `user.subtitle` opcional, que pasa al `UserMenu`.
- `AuthLayout` ("Autenticación" · 02): debajo de 640px la tarjeta ocupa todo el ancho, sin sombra
  ni borde. Solo CSS; la API no cambia.

Cambios de la tanda 3 (búsqueda, US-34), también **pendientes de subir** al final del Sprint 1:
- **Nuevo: `SearchSidebarFilters`** (`components/forms/`): la barra lateral de filtros de
  "Búsqueda de propiedades" · 01 (ubicación con provincia, ciudad y barrios múltiples, precio,
  tipología, dormitorios y ambientes de selección múltiple, superficie, características e índice) y,
  con `variant="drawer"`, el contenido del Drawer móvil (· 03: tipología en pastillas y precio con
  slider). Trabaja sobre un borrador y aplica con `onApply`. `data-testid` con prefijo
  `search-sidebar-` o `search-drawer-` según la variante. Sin "Dúplex" (no existe en el sistema).
  `SearchFilters` (la barra horizontal) no cambió.
- `PropertyCard`: prop `layout="busqueda"` (componente interno `PropertyCardBusqueda`) con la
  tarjeta de /buscar: precio en dorado "por mes", expensas, dirección aproximada, "barrio · título",
  descripción en 2 líneas y disponibilidad (estas dos las pide US-34, no el diseño), chips y carrusel
  si hay más de una foto. Link "estirado" para que las flechas del carrusel sean botones válidos.
  `adjustmentIndex` acepta `null` (sin badge). La API anterior no cambió.

Sprint 2, tanda 1 (detalle público, US-41, y solicitudes, US-35). **Sin cambios en `@rentar/ui`.**
Candidatos a pasar al design system (necesitan el OK del PO antes de tocar el paquete):
- **`OwnerCard`** ("Detalle de propiedad" · 01 lo presenta como componente nuevo): hoy es local,
  `apps/web/src/components/detalle-propiedad/OwnerCard.tsx`, armada con `Card` y `Avatar` de antd.
  Avatar con iniciales, nombre (o "El dueño" si no se conoce), la acción principal como slot,
  "Enviar mensaje" deshabilitado con tooltip y secciones extra como `children`. Sin WhatsApp (no hay
  teléfono del dueño en ninguna fuente).
- `PhotoGallery` en móvil: el diseño (· 03) pide carrusel con swipe y puntos, sin miniaturas. Hoy
  se usa tal cual (imagen grande + miniaturas en todos los anchos).

Sprint 2, tanda 2 (solicitudes: US-36, US-37 y US-38), **pendiente de subir** (aprobado por el PO
el 2026-10-07):
- **`ConfirmActionModal`: props opcionales `children` y `confirmLoading`.** `children` va debajo de
  `description` (el diseño "Flujo de solicitudes" · 03 lo pide así: "con el cuerpo extra como
  children"); `confirmLoading` deja el spinner en el botón de confirmar mientras corre la acción.
  Los usos anteriores no cambian. Ejemplo nuevo en `/design-system` ("Aceptar solicitud").
- Sin componentes nuevos: la fila de solicitud ("RequestCard") quedó local en
  `apps/web/src/components/solicitudes/` y `mis-solicitudes/`. Candidata a pasar al design system
  si se repite en otra pantalla.
- **Pendiente de corregir en el template "Flujo de solicitudes" (Claude Design), no se tocó:** el
  dominio `solicitud` de `StatusTag` ya existe (la hoja dice que falta); el motivo al rechazar y el
  "no puede volver a solicitar por 30 días" no van; el locador cancela una aceptada (US-38); una
  sola aceptada por propiedad ("Podés aceptar a más de una persona" ya no vale); el locatario ve la
  dirección aproximada en Mis solicitudes.
- **Texto nuevo para el template "Flujo de solicitudes" · 06 (vacío del locador), pedido por el PO
  el 2026-10-07:** el diseño tiene dos casos y la app tres. Con propiedades publicadas: "Todavía no
  recibiste solicitudes" + "Ver mis propiedades". Sin ninguna propiedad: "Publicá tu primera
  propiedad" (el del diseño). **Nuevo:** con propiedades pero ninguna publicada (ej. solo
  alquiladas o pausadas): "Ninguna de tus propiedades está publicada. Las solicitudes llegan solo a
  las publicadas.", con "Publicar una propiedad" (primario) y "Ver mis propiedades".

Sprint 2, tanda 3 (detalle de la propiedad del locador: US-03 y US-04), **pendiente de subir**
(aprobado por el PO el 2026-10-07):
- **`ConfirmActionModal`: prop opcional `hideCancel`.** Saca el botón secundario y deja solo el de
  confirmar, para avisos sin nada que elegir ("No podés eliminar una propiedad con contrato
  vigente" · "Entendido"). La cruz y Escape siguen cerrando. Los usos anteriores no cambian. Ejemplo
  nuevo en `/design-system` ("Aviso sin botón secundario").
- **Desvío del diseño, "Eliminar" con contrato vigente:** "Detalle de propiedad del locador" · 01 dice
  que las acciones destructivas bloqueadas van "deshabilitadas con tooltip". En la app, "Eliminar"
  queda **habilitado** y abre el aviso de bloqueo (· 05, "Bloqueado por contrato vigente"): un botón
  deshabilitado no recibe foco ni toque, y el tooltip no se ve en móvil. Decisión del PO.
- **Pendiente de corregir en el template "Detalle de propiedad del locador" (Claude Design), no se
  tocó:** la numeración (la pestaña Contrato dice US-03 y Cobros/Reclamos US-04; en Jira US-03 es
  modificar y US-04 es eliminar); en esta tanda solo va la pestaña Resumen; sin "Pausar" (no tiene
  US ni endpoint); el aviso de bloqueo no ofrece pausar ni "Ver el contrato"; eliminar es lógico y
  avisa cuántas solicitudes se cancelan; sin "Modificado · antes …" por campo en la edición.

Cambios de la tanda 4 (locador: /panel, US-02 y US-01), también **pendientes de subir** al final del
Sprint 1. Todas las props son nuevas y opcionales: los usos anteriores no cambian.
- `WizardLayout` ("Alta de propiedad" · 01, 06, 07 y 09): `status: 'error'` por paso (el Steps lo
  marca en rojo), `navigableSteps` (volver a un paso anterior tocándolo; hacia adelante nunca),
  `loading` (botones en carga y pasos bloqueados), `nextLabel`. Debajo de 768px el Steps se
  reemplaza por nombre del paso + "Paso N de M" + barra de tramos + "Siguiente: X", y los botones
  quedan fijos abajo a todo el ancho (en el último paso, solo el primario).
- `DataTable` ("Listado de propiedades" · 02 y 03): `onRowClick` (la fila entera abre el detalle:
  cursor, fondo #f4f7fa al pasar, Tab + Enter), `rowLabel` (texto accesible), `cardHeader` y
  `cardActions` para la tarjeta móvil, y `hideInCard` por columna.
- `UserMenu` ("Cambio de rol" · 04): sección **"Viendo como"** (`roleOptions` + `onRoleChange`):
  una fila de 52px por rol, ✓ en el activo y contador rojo en el otro. **Reemplaza al ítem
  "Cambiar a mi panel de…" de la tanda 2.** Apertura controlada opcional (`open`/`onOpenChange`).
  En móvil el botón muestra solo el avatar.
- `AppShell` ("Cambio de rol" · 04): barra móvil ☰ · `mobileTitle` · campanita · avatar; con
  `activeRoleLabel` (dos roles), debajo de 768px un chip con el rol activo que abre la misma hoja que
  el avatar. `mobileHeader` reemplaza la barra en flujos enfocados (el alta: "‹ Publicar propiedad ·
  Salir"). Pasa `roleOptions`/`onRoleChange` al `UserMenu`.
- `PropertyCard` / `PropertyCardBusqueda`: prop opcional `referenceDate?: Date` (el "hoy" contra el que
  se decide "Disponible desde" o "Disponible ahora"; por defecto, la fecha actual). `apps/web` le
  pasa su "hoy", fijo en modo mock.
- Compuestos en `apps/web` (no en `@rentar/ui`, aprobado por el PO): la carga de fotos del alta, el
  contador ±, las tarjetas de medios de pago e índice, las StatCards compactas del panel móvil y
  las tarjetas del onboarding.
- Lo que no se tomó de los templates (decisión del PO, anotado para no "corregirlo" en el próximo
  sync): tipos Local y Cochera, el mapa del alta, la antigüedad por rangos, "Disponible" como estado,
  amenities fuera del catálogo de 5, el banner de suscripción del panel y las personas y barrios del
  export que no están en el elenco.

Cambios posteriores a la subida del 2026-09-24, **pendientes de subir** en el próximo `/design-sync`:
- `AppShell` (2026-09-25, pedido del PO): el layout llega siempre al alto de la pantalla. antd
  pisaba el `min-height: 100vh` con su `.ant-layout { min-height: 0 }` (misma especificidad, se
  inyecta después), y con poco contenido el sidebar quedaba corto. Arreglo: clase doble en
  `.layout` y `.layoutCompact`. No cambia props ni el aspecto con contenido largo.
- `AppShell` (2026-09-25, pedido del PO): el logo del menú lateral y del menú móvil es un link a la
  landing. Prop nueva y opcional `logoHref` (por defecto `/`), `data-testid="app-shell-logo-link"`.
  NOTA: el mapa decía que el logo del AppShell lleva a `/panel`; el PO lo cambió a la landing.

Cambios de la conexión con el back (`feature/conexion-back`, 2026-09-25):
- **Se sacó "Recordarme"** del login (`apps/web/src/components/auth/LoginForm.tsx`, decisión del PO).
  Con Supabase Auth la sesión dura hasta que la persona la cierra, así que la opción no hacía nada.
  No es un cambio de `@rentar/ui` (el formulario vive en `apps/web`), pero **el template de Claude
  Design "Autenticación" · 01 y 02 todavía lo muestra**: actualizarlo ahí, y no volver a agregarlo
  si se implementa desde un export. "¿Olvidaste tu contraseña?" queda solo, alineado a la derecha
  arriba del botón en escritorio y debajo del botón en móvil (como ya estaba). Se borró el
  `data-testid` `login-remember-checkbox` (avisado a QA).
- **`SimulatedFeatureNotice`: prop opcional `reason`** (aprobada por el PO, **pendiente de subir**).
  Es el motivo de la simulación como oración completa; sin `reason`, el texto es exactamente el de
  antes ("… — no hay backend conectado en esta etapa."). El registro la usa en modo real: "El
  servidor todavía no envía emails de confirmación." Ejemplo sumado en `/design-system`; al subir,
  agregar una historia `ConMotivo` en `previews/SimulatedFeatureNotice.tsx`.
- **Fotos que no cargan → placeholder** (aprobado por el PO). El `ImageComponent` que `apps/web`
  inyecta en el `NextBridgeProvider` de `@rentar/ui` (`AppImage`, en `apps/web/src/lib/next-bridge.tsx`)
  ahora pasa a `/placeholder-propiedad.svg` si la imagen falla, en vez del ícono de imagen rota
  (`lib/imagenes/fotoConRespaldo.ts`). Afecta a todo lo que dibuja imágenes por el puente
  (`PropertyCard`, `PropertyCardBusqueda`, logos). **El `DefaultImage` de `@rentar/ui` (el `<img>` de
  las previews de Claude Design) no cambió**: en el proyecto de Claude Design una foto rota se sigue
  viendo rota. Si se quiere lo mismo ahí, sumar el respaldo al `DefaultImage` en el próximo sync.

Cambios del modelo de roles (2026-09-27, rama `feature/roles-publicar`), **pendientes de subir**.
Regla del equipo: todos se registran como locatarios y pasan a ser también locadores al publicar
su primera propiedad. Exports leídos en `.design-exports/roles/` (Paneles · 05b, Autenticación ·
03 y 05, `templates/_shared/publicar-propiedad.js`).
- **`AppShell`: prop opcional `headerAction`** (`AppShellHeaderAction`: `label`, `href`, `icon?`,
  `data-testid?`), la que el template anuncia en `_shared/publicar-propiedad.js`. Desde 768px es
  un botón blanco con borde antes de la campanita; debajo de 1024px también va primero en el menú
  hamburguesa (`<testid>-drawer`); debajo de 768px sale de la barra y pasa a la hoja del
  `UserMenu`. Es un link y no un `ReactNode` porque se dibuja en tres lugares. Al subir: borrar
  `templates/_shared/publicar-propiedad.js` y su línea en cada `ds-base.js`, y sumar una historia
  con `headerAction` en `previews/AppShell.tsx`.
- **`UserMenu`: prop opcional `sheetLeadingItem`** (un `UserMenuItem`): va primero en la hoja
  móvil, en azul y negrita; no aparece en el dropdown de escritorio. La pasa `AppShell` desde
  `headerAction` (`data-testid` `user-menu-item-header-action`).
- **`EmptyState`: prop opcional `actionBlock`** (por defecto `false`, igual que antes): debajo de
  640px la acción ocupa todo el ancho, como los botones de Paneles · 05b en móvil. Hoy la usa solo el
  panel del locatario (`apps/web/src/components/panel/PanelLocatario.tsx`). Al subir, sumar una
  historia `AccionAnchoCompleto` en `previews/EmptyState.tsx`.
- **Contradicciones del diseño con la regla nueva (no se tocaron; pendientes para quien lleva
  Claude Design):**
  1. Paneles · 06 ("Locatario nuevo · Onboarding"), paso "Cuenta creada": dice "Podés activar
     también el rol de locadora cuando quieras, desde tu perfil". Con la regla nueva el rol de
     locador no se activa desde el perfil: se gana al publicar. La app usa la versión mínima (05b),
     no este checklist.
  2. `templates/_shared/context-switcher.js` (el shim de "Viendo como" de los templates) ofrece
     "Activar mi rol de locador · Se activa desde mi perfil, sin crear otra cuenta". En la app ese
     texto no existe y "Viendo como" (`RoleContextSwitcher`) quedó sin cambios, por decisión del PO.

Cambios del Header público con sesión (2026-09-29, rama `feature/header-sesion`), **pendientes de
subir**. Export leído en `.design-exports/header/` (`templates/header-publico/HeaderPublico.dc.html`,
que pide "sumar la prop `user` en código").
- **`Header`: props opcionales `session` y `sessionPending`.** Sin props, el Header sin sesión de
  siempre. `session` (`HeaderSession`: nombre, rol activo, avatar, `panelHref`, `publishHref`,
  `menuItems` y `onLogout`) cambia "Iniciar sesión" + "Publicar propiedad" por "Ir a mi panel" + el
  `UserMenu`; en móvil, el menú hamburguesa trae el usuario, "Ir a mi panel", "Publicar propiedad",
  los links y "Cerrar sesión". `sessionPending` muestra un placeholder con la forma de la variante
  con sesión (sin "Iniciar sesión") mientras la app la confirma. Se llamó `session` y no `user`
  (como dice el template) porque trae también las acciones, no solo el usuario.
- **`PublicLayout`: prop opcional `header`** para recibir el Header ya armado (el layout es un
  Server Component y no le puede pasar funciones al Header).
- Al subir: sumar historias `ConSesion` y `CargandoSesion` en `previews/Header.tsx`.
- **Pendiente de sumar al template "Autenticación" (Claude Design): el estado "Revisando tu
  sesión…"** de `/login` y `/registro`. Con la sesión abierta, esas pantallas llevan a `/panel` y,
  mientras se confirma la sesión o se redirige, muestran un spinner de antd centrado con el texto
  "Revisando tu sesión…" en vez del formulario (`apps/web/src/components/auth/RevisandoSesion.tsx`,
  `data-testid` `auth-revisando-sesion`). No es un cambio de `@rentar/ui`: vive en `apps/web`, pero
  el template todavía no tiene ese estado. Sumarlo en la sección 05 ("Estados de carga, error y
  éxito") para que el diseño quede alineado.

Cambios del QA de `develop` (2026-09-30, `feature/vistas`), **pendientes de subir** (a confirmar con
el PO: no cambian nada visual):
- **`UserMenu`: `aria-label` en el botón que abre el menú** (`"<nombre>, <rol>. Menú de la cuenta"`).
  Debajo de 768px el nombre y el rol se ocultan y el botón quedaba solo con el avatar, sin nombre
  para un lector de pantalla. El label arranca con el texto visible en escritorio. Se puede pisar
  con `aria-label` en las props (va antes del `...rest`).
- **`SearchSidebarFilters`: nombre en español del botón de borrar** de Provincia, Ciudad y Barrio
  (`allowClear={{ label: 'Borrar la provincia' }}`, etc.). antd lo dejaba en inglés ("Clear").

Cambios de la landing nueva (2026-10-01, rama `feature/nuevo-landing`), **pendientes de subir**
(aprobados por el PO en el plan de la landing):
- **Tokens nuevos** (`tokens/primitives.ts` y `css-vars.css`; `design-sync-fonts.css` regenerado):
  `spacing['2xl']` (6rem), `breakpoints` (sm 576 · md 768 · lg 992 · xl 1200, los de antd),
  `layout.containerMax` (1200 px, `--rentar-container-max`), `motion` (duraciones de 160, 240 y
  400 ms, curvas `out`, `inOut` y `drawer`, escalonado de 60 ms; `--rentar-motion-*`) y los tamaños
  de `typography` como variables (`--rentar-font-size-display|headline|title|body|label`). Además
  (aprobado por el PO el 02/10/2026, a partir de la revisión final de impeccable) un escalón nuevo,
  `typography.displayHero` / `--rentar-font-size-display-hero` (`clamp(2.25rem, 5vw, 4rem)`): el H1
  de la landing desde 768 px; en móvil sigue en `display`.
  NOTA: `--rentar-color-sky-rgb` vale el celeste CLARO (#E3F2FB), no #A0D1EF. Quedó solo anotado
  en `css-vars.css`; no se cambió.
- **Nuevo: `HeroSearch`** (`components/forms/`): el buscador del hero ("A · La consola"). Controles
  nativos con la piel de los campos de `/buscar`, dentro de un `<form method="get">` que funciona
  sin JS; con `onSearch`, el envío lo resuelve la app. "Más filtros" es un `<details>`: panel
  flotante desde 768 px y hoja desde abajo en móvil (con JS, diálogo modal con el foco atrapado y
  `aria-expanded` en el resumen). Con JS, cierra animado por donde entró (la hoja baja en 240 ms; el
  panel se desvanece hacia su botón en 160 ms); con "reducir movimiento", al instante. Una columna en móvil, dos desde 768 px y una sola fila cuando el
  buscador mide 70rem o más. NOTA: ese corte es un container query (con un corte por pantalla, en
  992 px, los selects se cortaban entre 992 y 1167 px y en `/design-system`). `data-testid` con el
  prefijo que se le pase (la landing usa `landing-buscador`). Al subir: sumar
  `previews/HeroSearch.tsx` con historias de escritorio, de 768 px y de móvil con la hoja abierta.
- **`PropertyCardBusqueda`: hover nuevo** (también en `/buscar`, decisión del PO): solo con
  puntero fino, la foto se acerca (`scale(1.04)`) y la sombra pasa a `lifted` con una capa de
  opacidad. Con "reducir movimiento", sin zoom. La API no cambia.
- **`Header`: el nav completo aparece desde 992 px** (antes 768) y los links van con `nowrap`:
  entre 768 y 991 px se partían en dos líneas. En ese rango queda el menú hamburguesa. La API no
  cambia.
- **`SearchFilters` (la barra horizontal) quedó sin uso:** la landing usa `HeroSearch` y `/buscar`
  usa `SearchSidebarFilters`. Candidato a borrar de `@rentar/ui` y de Claude Design en el próximo
  sync (consultarlo con el PO). Sigue en `/design-system` con esa nota.
- Quedan en `apps/web` (no en `@rentar/ui`): las secciones de la landing
  (`components/landing/`), el motivo `ProcessLoopMotif` (mejorado: tokens, ícono de "Postulate",
  órbita circular y estados `quieto`/`corriendo`/`pausado`) y `RevealAlEntrar`. Se borraron
  `SearchBar`, la `PropertyCard` de la landing, `HowItWorks` y `useInView`.
- **`Header` y `Footer`: el mismo contenedor que las páginas públicas** (aprobado por el PO): contenido
  de hasta 1200 px (`--rentar-container-max`) más el margen lateral, que pasa de 1rem a 1.5rem desde
  992 px (antes 640), como `/buscar`. Antes medían 72rem con el margen adentro: en 1440 px el logo
  quedaba 48 px corrido respecto de `/buscar` y 24 px respecto de la landing. El `Footer` pone logo y
  links en fila desde 768 px (antes 640). La API no cambia.

Preparación del `/design-sync` del Sprint 2 (2026-10-08, `feature/vistas` con `develop` y el PR #10):
- **`SearchFilters` deprecado** (decisión del PO, 08/10/2026): JSDoc `@deprecated` ("sin uso desde el
  PR #10; lo reemplazan `HeroSearch` y `SearchSidebarFilters`"). **No se borra en este sync**: se
  borra de `@rentar/ui`, de `previews/` y de Claude Design cuando se actualicen las vistas de Claude
  Design que todavía lo usan (entra en el prompt del Sprint 2 para Claude Design). Leído en Claude
  Design el 08/10/2026 (16 de las 23 vistas; las 7 sin abrir son de panel sin búsqueda: cambio de
  rol, detalle de cobro, mensajes, mi perfil, notificaciones, pagar alquiler y suscripción):
  **ninguna vista monta `RentarUI.SearchFilters`**. Solo lo nombran como texto
  `templates/busqueda-propiedades/BusquedaPropiedades.dc.html` (recuadro "Componentes nuevos en
  juego: PropertyCard · SearchFilters") y `templates/mapa-de-pantallas/MapaDePantallas.dc.html`
  (lista de componentes: "SearchSidebarFilters · SearchFilters"). NOTA: "Búsqueda de propiedades"
  dibuja los filtros y las tarjetas a mano (solo monta `Header`, `Footer`, `IndexBadge`,
  `EmptyState` y `ThemeProvider`): al actualizarla, que use `SearchSidebarFilters` y
  `PropertyCard layout="busqueda"`. La landing no tiene vista en Claude Design.
- **Previews nuevas o ampliadas:** `previews/HeroSearch.tsx` (`Escritorio`, `Tablet768`,
  `MovilConHojaAbierta`) y `previews/ConfirmActionModal.tsx` (`ConCuerpoYCarga`, con `children` y
  `confirmLoading`; `AvisoSinCancelar`, con `hideCancel`). NOTA: en `HeroSearch` la fila única es un
  container query (sigue al ancho de la historia), pero el panel flotante o la hoja y el lugar de
  "Dormitorios" siguen al ancho del viewport de la card (media query + `matchMedia`).

## Tarea aparte: peso del JS común (Lighthouse móvil), para después del merge de la landing

Decisión del PO (01/10/2026): no se resuelve en `feature/nuevo-landing`. Queda acá y en la
descripción del PR de la landing.

**Números** (build de producción en modo mock, Lighthouse 12 con el perfil móvil por defecto, Edge
sin interfaz):

| Página | Performance (simulado) | LCP simulado | Performance (estrangulamiento real) | JS transferido |
|---|---|---|---|---|
| `/` (landing) | 76–77 (3 corridas) | 6,0 s | 94 (LCP 1,8 s, CLS 0) | ~750 KB en 20 archivos |
| `/login` | 76 | 5,9 s | — | ~746 KB |
| `/buscar` | 72 | 6,9 s | — | ~757 KB |

Accesibilidad, buenas prácticas y SEO dan 100 en la landing.

**En modo real** (06/10/2026, build de producción contra la API local, Lighthouse 12.8.2, perfil
móvil, Edge sin interfaz, mediana de 3): `/` da Performance 70 (69, 71 y 70), FCP 1,2 s, LCP 6,4 s,
TBT 340 ms y CLS 0; accesibilidad, buenas prácticas y SEO, 100. Con el hero azul, el LCP pasó a ser
la ilustración de la ciudad (`/landing/hero/ciudad-750.webp`), no el titular. "Recién publicadas"
no pesa en el LCP: llega por streaming dentro de `Suspense` (el esqueleto a ~140 ms; las tarjetas
cuando responde `/disponibles`, 7–10 s). Con estrangulamiento real (devtools, mismo día, mediana de
3): Performance 87, FCP 2,07 s, LCP 2,08 s (la ilustración), TBT 412 ms y CLS 0.

**Numeración de los RNF (para corregir aparte, 06/10/2026):** `docs/PRODUCT.md` no sigue la
numeración del Estudio Inicial, que es la que manda para la cátedra. Por ejemplo, `PRODUCT.md` usa
RNF-12 para "liviano en conexiones móviles" y RNF-10 para usabilidad, pero en el Estudio Inicial
RNF-12 es "persistencia sobre Supabase" y RNF-10 es eficiencia de desempeño (búsqueda fluida en
conexiones móviles estándar). El responsive es RNF-02 en los dos. Revisar todas las menciones de RNF
en `PRODUCT.md` (y en `DESIGN.md`, si las hay) contra el Estudio Inicial.

**Diagnóstico.** El LCP medido es el titular y coincide con el FCP (~0,2 s en local). La diferencia
viene del método simulado: cuenta como dependencia del LCP todo pedido que no sea imagen y que haya
empezado antes del pintado, y los ~750 KB de JS empiezan a bajar a los 35–90 ms. Ese JS es del
armazón común (layout raíz, providers y Header), no de la landing: `/login` pesa lo mismo. Los
chunks más grandes:
- antd y sus dependencias (`@ant-design/cssinjs`, `@rc-component/*`, `rc-util`): ~205 KB
  transferidos en el chunk principal más otros ~100 KB.
- El cliente de Supabase (`@supabase/ssr`, GoTrueClient, realtime) junto con el store de mocks:
  ~69 KB transferidos (262 KB sin comprimir). Se carga en todas las páginas, también en modo mock.
- Las herramientas de desarrollo (`DevTools` → `RoleSwitcher` importado del barril de
  `@rentar/ui`): ~32 KB. `DevTools` devuelve `null` en producción, pero el import estático lo
  deja en el bundle.
- `react-dom`: ~64 KB (no se puede sacar).

**Desglose del LCP de `/`** (Lighthouse 12, perfil móvil, mediana; build de producción en modo mock,
02/10/2026). El LCP es el H1 ("Alquilá directo con el dueño"):
- **Observado** (la traza sin estrangular): TTFB 26 ms + retraso de render 195 ms = LCP 221 ms, igual
  al FCP. Sin "load delay" ni "load time": es texto.
- **Simulado:** TTFB 456 ms + retraso de render 5.867 ms = LCP 6,3 s (FCP simulado: 1,2 s). El modelo
  simulado de Lighthouse (Lantern) cuenta como dependencia del LCP todo pedido que no sea imagen y
  que arranque antes del pintado observado: 26 pedidos y 823 KB (el documento, la fuente, 4 hojas de
  estilo y 20 scripts, que empiezan a bajar entre los 35 y los 90 ms). El FCP solo cuenta lo que
  bloquea el render, por eso da 1,2 s. Con estrangulamiento real (devtools) el LCP es 1,9 s y
  coincide con el FCP.
- **Qué no lo retrasa (verificado):** la fuente (League Spartan con `next/font`, `display: 'swap'`,
  precargada por la cabecera HTTP `Link`: sale a los 29 ms con prioridad alta y llega a los 38 ms)
  y la hidratación (el H1 y el buscador están en el HTML inicial, antes del primer límite de
  `Suspense`, y el H1 se pinta antes del DOMContentLoaded; no tiene animación de entrada).
- **Qué marca el piso del pintado:** 4 hojas de estilo que bloquean el render (21 KB; Lighthouse
  estima 456 ms de ahorro) y el CSS de antd en línea que mete el registry SSR (`AntdRegistry`) en el
  `<head>`, antes del titular: 55 KB en `/`, 183 KB en `/login` y 201 KB en `/buscar` (el HTML de
  `/` pesa 183 KB sin comprimir).
- **Conclusión:** la landing y `HeroSearch` no demoran el titular; lo que pesa es del armazón común.

**Propuesta de arreglo** (una rama aparte, con mediciones antes y después; los comandos y opciones están en la documentación de Next 16 instalada, `node_modules/next/dist/docs/01-app/02-guides/package-bundling.md`):
1. **Supabase solo cuando hace falta.** En `lib/auth/AuthProvider.tsx`, `services/auth.service.ts`
   y `services/propiedades.service.ts`, cambiar el import estático de `getSupabaseBrowserClient`
   (y el de `isAuthApiError`/`isAuthRetryableFetchError` de `@supabase/supabase-js`) por
   `await import('@/lib/auth/supabase/client')` dentro de las ramas reales (`USE_MOCKS === false`).
   En modo mock no se baja nunca; en modo real sale del bundle inicial y llega después de hidratar.
   Ahorro esperado: ~69 KB por página.
2. **Herramientas de desarrollo fuera del bundle de producción.** En `lib/AppProviders.tsx`,
   montar `DevTools` con `next/dynamic(() => import('@/components/dev/DevTools'), { ssr: false })`
   y solo si `process.env.NODE_ENV !== 'production'`. En `DevTools.tsx`, importar `RoleSwitcher`
   desde su archivo y no desde el barril. Ahorro esperado: ~32 KB.
3. **antd en las páginas públicas.** Medir con el analizador de bundles (`next experimental-analyze`
   en Next 16, o `@next/bundle-analyzer`). Después: en las páginas públicas, importar los componentes
   de `@rentar/ui` desde sus archivos (el barril, con sus CSS modules, impide descartar lo que no se
   usa), cargar el Drawer del menú móvil del Header recién al abrirlo y probar
   `experimental.optimizePackageImports` con `antd`, `@ant-design/icons` y `@rentar/ui`.
4. **CSS que bloquea el render.** Medir `experimental.inlineCss` (Next 16, documentado en
   `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/inlineCss.md`):
   cambia las 4 hojas por `<style>` en el `<head>`, a costa de que los que vuelven no las tengan en
   caché. Y evaluar la extracción estática de los estilos de antd (`@ant-design/static-style-extract`,
   documentada por antd 6) para servir un CSS cacheable de los componentes que usan las páginas
   públicas, en vez de 55 a 201 KB de CSS en línea por página.
5. **Precarga de la ilustración del hero, solo en `/`** (sumado el 02/10/2026, decisión del PO).
   Con el hero azul, el LCP de `/` pasó a ser la ciudad ilustrada (`LandingHero`, ver
   `apps/web/public/landing/IMAGES.md`): 2,35 s con estrangulamiento real (mediana de 3; antes, con
   el titular, 2,25 s). Desglose con estrangulamiento real: TTFB ~40 ms, **load delay ~630 ms**,
   load time 1,3–1,5 s (16 KB, compitiendo por la red con el CSS y el JS del armazón) y render delay
   200–400 ms. El load delay viene de dónde está la `<img>`: en el **byte 61 K** de un HTML de
   150 KB, justo después de un `<head>` de ~59 KB (casi todo CSS de antd en línea del registry SSR),
   así que el escáner la encuentra tarde. Probar un `<link rel="preload" as="image" imagesrcset
   media fetchpriority="high">` (uno por recorte: 1200/1600 desde 768 px y 480/750 por debajo) al
   principio del `<head>`, solo para `/`, sin tocar el layout común. `preload()` de `react-dom`
   desde el componente **no sirve**: la página es dinámica y esa precarga sale solo en el payload
   RSC, después del `<head>` (probado). Bajar el CSS en línea (punto 4) también acerca la `<img>`
   al principio del HTML.
6. **Objetivo y verificación:** bajar el JS común de ~750 KB a menos de 450 KB transferidos, y
   Performance simulado ≥ 90 en `/`, `/login` y `/buscar` (mediana de 3 corridas), sin romper la
   sesión real (login, `/me`, logout) ni el modo mock.

## Regla: nada exclusivo de React 19 en `@rentar/ui` (2026-10-09)

**Los componentes de `@rentar/ui` no usan APIs exclusivas de React 19 (`useEffectEvent`, `use`,
etc.): las plantillas de Claude Design corren con React 18.3.1.** Las tarjetas de preview cargan
React 19.2.8 de `_vendor/` (por eso el render check pasaba), pero las plantillas
(`templates/*/support.js`) cargan React 18.3.1 desde unpkg. Pasó con `HeroSearch`: la landing de
Claude Design no renderizaba por "useEffectEvent is not a function". Se arregló con una ref
actualizada en `useLayoutEffect` + `useCallback`. En el mismo componente, `NativeSelect` recibía
`ref` como prop común (React 19); en React 18 no llega, así que pasó a `forwardRef`. Antes de
sumar un hook o patrón nuevo, chequear que exista en React 18.3. La regla también está en
`conventions.md`, para el agente de Claude Design.

## Re-sync del 2026-10-09 (borrado de `SearchFilters` y React 18)

- **`SearchFilters` borrado** (pedido del PO, anotado como pendiente el 08/10): componente, CSS,
  export, `previews/SearchFilters.tsx` y su entrada en `/design-system`; `apps/web` no lo
  importaba en ningún otro lado. En Claude Design, el diff del driver lo da como `removed` y borra
  `components/forms/SearchFilters/*` y `_preview/SearchFilters.*`. Quedan 34 componentes.
- **Los 7 `--rentar-motion-*` con `/* @kind other */`** en `tokens/css-vars.css` (aviso de
  `check_design_system`), con `design-sync-fonts.css` regenerado. Ojo al hacerlo con una regex: la
  línea de `--rentar-motion-stagger` va seguida de una línea en blanco y del comentario de la
  sección siguiente, y un lookahead `(?!\s*/\*)` la saltea.
- **`HeroSearch` sin `useEffectEvent` ni `ref` como prop común** (ver "Regla: nada exclusivo de
  React 19"). Probado en la app (Escape y clic afuera, escritorio y 390 px) y en las tarjetas con
  React 18.3.1 (ver el riesgo de abajo).

## Re-sync del Sprint 2 (2026-10-08)

Segundo re-sync desde este repo (camino atómico, anclado en el `_ds_sync.json` del 24/09), con
`feature/vistas` ya mergeada con `develop` (PR #10, landing nueva).

- **Comando** (desde la raíz, después de `cfg.buildCmd`): `node .ds-sync/resync.mjs --config
  .design-sync/config.json --node-modules ./node_modules --out ./ds-bundle --remote
  .design-sync/.cache/remote-sync.json`. `--node-modules` es el de la raíz: con npm workspaces
  `packages/ui` no tiene `node_modules` propio, y `node_modules/@rentar/ui` es el symlink al paquete
  (el converter lee `dist-types/`). Sin `--entry`.
- **Render check con el Chrome instalado:** no hay chromium en la caché de Playwright
  (`%LOCALAPPDATA%/ms-playwright` solo tiene la carpeta del `playwright-cli`). Se instaló
  `playwright` dentro de `.ds-sync/` con `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` (sin bajar navegadores)
  y se corrió todo con `DS_CHROMIUM_PATH="C:/Program Files/Google/Chrome/Application/chrome.exe"`
  (lo leen `package-validate.mjs` y `package-capture.mjs`). `.ds-sync/` entero está en el
  `.gitignore`, así que ni `playwright` ni su `package.json` entran al repo: se reinstalan en cada sync.
- **No correr el driver con la terminal parada adentro de `ds-bundle/`:** el build lo borra y
  rehace, y en Windows falla con `EPERM` sobre ese directorio.
- **`HeroSearch`: tarjeta en `cardMode: "column"` con `viewport: "1280x1500"`.** Con el viewport por
  defecto (900) la celda medía ~650 px y `Escritorio` salía en dos columnas (la fila única es un
  container query de 70rem). **Truco del iframe en `MovilConHojaAbierta`:** la hoja desde abajo y
  el lugar de "Dormitorios" dependen del ancho de la PANTALLA (media query + `matchMedia`) y la card
  tiene un solo viewport, así que con la card ancha la historia se recarga a sí misma
  (`?story=MovilConHojaAbierta`) dentro de un iframe de 375 px; adentro (`innerWidth < 768`) se
  dibuja el componente real y se abre el `<details>`. Si algún día el harness permite un viewport
  por historia, sacar el iframe.
- **`EmptyState`: `cardMode: "column"`** (lo pidió `[GRID_OVERFLOW]` por `AccionAnchoCompleto`).
- **`conventions.md`:** la línea de componentes de negocio recomienda `HeroSearch`,
  `SearchSidebarFilters` y `FilterBar`, y aclara que `SearchFilters` está deprecado (pedido del PO).
- Resultado: 35 componentes (34 + `HeroSearch`), 0 floor cards, render check sin `bad`, 35 grades
  `good` (31 cambiados + 4 verificados por la subida anterior). 183 archivos escritos, 0 borrados.
  No se tocó `templates/`. Verificado después en Claude Design: el README trae el encabezado nuevo y
  `HeroSearch` aparece en `components/forms/`.

## Re-sync del Sprint 1 desde SEM-Alq (2026-09-24)

Primer re-sync desde este repo (camino atómico, anclado en el `_ds_sync.json` del proyecto).

- **`buildCmd` cambió**: ahora es `npm run build --workspace=@rentar/shared-types && npm run build:types --workspace=@rentar/ui`.
  En SEM-Alq, `packages/ui/tsconfig.json` resuelve `@rentar/shared-types` a su `src/` (así la app no
  necesita compilarlo), y eso hacía fallar el build de declaraciones con TS6059 (archivos fuera de
  `rootDir`). `build:types` usa `packages/ui/tsconfig.types.json`, que lee `shared-types` desde
  `dist/`: por eso hay que compilar `shared-types` antes.
- **Tres previews faltaban en este repo** (`FileDropzone`, `MoneyInput`, `WizardLayout`): el proyecto
  las tenía (se subieron desde `feature/design-sync-setup` del repo anterior) pero no se habían
  copiado. Sin ellas, esas fichas habrían perdido su preview. Se recuperaron de esa rama. **Si otro
  `_preview/<Name>.js` del proyecto no tiene su `.tsx` en `previews/`, buscarlo ahí antes de subir.**
- **Previews nuevas**: `PasswordStrengthMeter`, `SearchSidebarFilters` y `SearchFilters`. **Historias nuevas** con las
  props del sprint: `WizardLayout` (`PasoConError`, `Publicando`), `DataTable` (`FilaClickeable`),
  `UserMenu` (`ViendoComo`, con `open`) y `PropertyCard` (`Busqueda`, con `referenceDate` fija).
- **Overrides nuevos** (por `[GRID_OVERFLOW]`): `PasswordStrengthMeter`, `SearchSidebarFilters` y
  `WizardLayout` en `cardMode: "column"` (`SearchSidebarFilters` con `viewport: 900x1400` para que no
  se recorte). `UserMenu` en `single` con `primaryStory: "ViendoComo"` y `viewport: 900x480`: con
  menos de 768px de ancho el `UserMenu` se dibuja como hoja móvil, no como dropdown. En la preview, el
  botón va arriba a la izquierda para que el dropdown se abra hacia abajo.
- **Cambios de fin de línea**: los fuentes pasaron de CRLF a LF, y eso cambia el hash del `.prompt.md`
  de casi todos los componentes aunque el texto sea idéntico (verificado con `DetailList`). Es ruido
  esperable de una sola vez, no un cambio real.
- **Known render warns** (triaged): `RoleSwitcher` se ve casi vacía (es una pestaña de 14px al borde,
  así se ve de verdad). `SearchFilters` mostraba "undefined" en el select de dormitorios: no tenía
  preview autorada y la floor card lo renderizaba con props vacías. Se autoró su preview (valores
  reales, sin tocar el componente).
- Resultado: 34 componentes, 0 floor cards, render check sin `bad`.
- **Subido desde el commit `98bd25d4455e27991dbf2b9066e3bd4158bc4a69`** (`chore(ui): Preparar la subida de /design-sync del Sprint 1`; era
  `7a26b94` antes del rebase sobre `origin/develop` — el rebase solo sumó cambios de `apps/api`, el
  contenido de `packages/`, `.design-sync/` y `apps/web` es idéntico),
  el 2026-09-24: 178 archivos escritos (136 de `components/`, 34 de `_preview/`, 2 de `_vendor/`, 4 de
  la raíz, el aviso `_ds_needs_recompile` y `_ds_sync.json` al final), 0 borrados. No se tocó `templates/`.
  Lo que está en Claude Design corresponde exactamente a ese commit.

## Contexto de esta corrida (2026-09-22)

Re-sync sobre `feature/fundaciones-app` (rama activa, ramificada de `develop`) contra el proyecto
"RentAR Design System" (`projectId: 0f707fbd-bf3d-4fbc-a8f3-74c68d6e4cb7`), que ya tenía una
sincronización previa de 24 componentes — hecha, aparentemente, desde `feature/design-sync-setup`
(rama hermana, nunca mergeada a `develop`). No había `.design-sync/config.json` en este working
tree; se reconstruyó desde cero en esta corrida.

**Alcance de previews**: el usuario eligió el camino rápido — floor cards para los 32 componentes
(igual que estaban los 24 originales, no es una regresión) + preview autoral solo para los 2 que
renderizaban en blanco (`MoneyAmount`, `NotificationBell`). El resto queda como oferta permanente
para autorar incrementalmente en cualquier sync futuro.

## Decisiones de config (por qué quedaron así)

- `pkg: "@rentar/ui"` — faltaba en el primer intento y el error del build (`required: --config
  --node-modules --out`) no lo señala directamente; si vuelve a pasar, es casi siempre `cfg.pkg`
  vacío, no un flag de CLI faltante.
- `globalName: "RentarUI"` — fijado a mano. Sin esto, la auto-derivación desde `@rentar/ui` da
  `RentarUi` (I minúscula), distinto del `window.RentarUI` que ya usan las 20 pantallas armadas en
  `templates/*.dc.html` de este proyecto. **Si algún día se quita este override, revisar que las
  plantillas existentes no queden rotas.**
- `cssEntry: "src/design-sync-fonts.css"` — ver la sección de abajo, es el único slot de CSS extra
  que admite el conversor (un solo archivo, sin resolver `@import` locales).
- `provider: { component: "ThemeProvider" }` — sin esto, todo antd (Button, Select, Tag...) usa el
  azul default de antd en vez del azul de marca. Restaurado en esta corrida (ver próxima sección).

## `ThemeProvider` restaurado

`packages/ui/src/components/ThemeProvider.tsx` no existía en `feature/fundaciones-app` — vivía
solo en `feature/design-sync-setup` (commit `271dcca`), rama que nunca se mergeó a `develop`. Se
recreó en esta corrida con el mismo contenido (wrapper de `ConfigProvider` + `antdTheme`/
`antdThemeDark` + `antdLocale`), exportado desde `components/index.ts`, y cableado como
`cfg.provider` para que las previews de Claude Design apliquen el tema de marca. **Si en algún
futuro merge `develop` diverge de esto (por ejemplo, alguien borra `ThemeProvider` a propósito
porque `apps/web` arma su propio `ConfigProvider` a mano y nunca lo usa), hay que decidir de nuevo
si mantenerlo solo para este propósito.**

## `design-sync-fonts.css` — riesgo de desincronización (leer antes del próximo sync)

`cfg.cssEntry` solo admite **un** archivo, y el conversor lo copia tal cual (no resuelve
`@import` locales — confirmado empíricamente: un `@import` relativo a otro archivo del paquete
queda roto una vez servido desde `ds-bundle/`, tira `[CSS_IMPORT_MISSING]`). Por eso
`packages/ui/src/design-sync-fonts.css` es la **concatenación** de:
1. Un header fijo (`design-sync-fonts.css.header`, sí commiteado): el `@import` remoto de Google
   Fonts para League Spartan + la regla `body { font-family: ... }` (necesaria porque acá no hay
   `next/font` ni `globals.css` de `apps/web`).
2. Una **copia pegada a mano** del contenido completo de `packages/ui/src/tokens/css-vars.css`.

**Si `tokens/css-vars.css` cambia, hay que regenerar el archivo combinado antes del próximo
`/design-sync`:**

```bash
cat packages/ui/src/design-sync-fonts.css.header packages/ui/src/tokens/css-vars.css \
  > packages/ui/src/design-sync-fonts.css
```

Si este paso se olvida, el build igual funciona (no hay ningún check automático que lo detecte) —
pero los tokens `--rentar-*` que vea Claude Design van a quedar desactualizados en silencio.

## Fuente de la tipografía

League Spartan se carga vía `@import` remoto a Google Fonts (no está self-hosteada en el bundle,
a diferencia de `apps/web` que la sirve vía `next/font/google`). `[FONT_REMOTE]` en el validate es
esperado y no bloquea — la familia carga en runtime desde el navegador de quien vea el diseño.

## Known render warns (triaged, no perseguir en el próximo sync)

`[RENDER_THIN]` en `StatCard`, `FormSection`, `AuthLayout` — floor cards legítimos (nunca se
autoró una preview para estos tres), muestran solo el nombre del componente. No es una regresión.

- `EmptyState` · `AccionAnchoCompleto` se ve igual que `Default`: `actionBlock` solo actúa debajo de
  640 px de PANTALLA, y la card mide más. La historia queda para documentar la prop (08/10/2026).
- `check_design_system` avisa por `--hero-search-control: 2.5rem` dentro de `.HeroSearch_form`
  (`components/forms/HeroSearch.module.css:24`): es una medida interna del componente (el alto de
  sus controles), no un token del sistema. Se deja donde está (decisión del PO, 08/10/2026).
- `Header` muestra el link "Sistema de diseño" en las previews: el componente lo esconde solo en
  producción de `apps/web`. Es esperable.

## Re-sync risks

- **El render check corre con React 19.2.8 y las plantillas con React 18.3.1.** Las tarjetas
  cargan `_vendor/react.js`, que el converter arma desde el `react` del repo; ni el config ni
  `package-validate.mjs` tienen una opción para cambiar la versión. Por eso el render check pasó
  con `useEffectEvent` y la landing de Claude Design se rompió. Chequeo manual (09/10/2026, las 34
  tarjetas dieron bien): servir `ds-bundle/` con `node .ds-sync/storybook/http-serve.mjs
  ./ds-bundle`, bajar `https://unpkg.com/react@18.3.1/umd/react.development.js` y
  `https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js`, y en Playwright reemplazar
  `**/_vendor/react.js` y `**/_vendor/react-dom.js` con esos dos (`page.route` + `route.fulfill`),
  abrir cada `components/*/*/<Name>.html` y buscar `pageerror`. Hacerlo en cada sync que toque
  hooks.

- **El índice de componentes del README pierde las letras acentuadas** ("vaco", "ttulo", "pgina"):
  lo arma el converter desde la primera línea del JSDoc y descarta lo que no es ASCII. Los
  `.prompt.md` sí llevan los acentos. Visto el 08/10/2026; no se tocó el converter.
- **El iframe de `previews/HeroSearch.tsx#MovilConHojaAbierta`** depende de que la card responda a
  `?story=`; si el harness cambia eso, la historia se vería vacía.

- **`design-sync-fonts.css` puede quedar desactualizado** si `tokens/css-vars.css` cambia y nadie
  corre el `cat` de arriba — ver la sección dedicada.
- **20 pantallas ya armadas en `templates/`** (los `.dc.html` del proyecto) dependen de
  `window.RentarUI` con esa capitalización exacta y de que los 32 componentes existan con estos
  nombres — no renombrar componentes ni cambiar `globalName` sin revisar esas plantillas primero.
- **(Histórico, 2026-09-22; desde el 2026-09-24 hay 0 floor cards)** 11 componentes seguían en floor card (`ActivityTimeline`, `AppShell`, `ConfirmActionModal`,
  `DataTable`, `EmptyState`, `NextBridgeProvider`, `PageHeader`, `PhotoGallery`,
  `RoleContextSwitcher`, `RoleSwitcher`, `ThemeProvider`) + los 3 "thin" de abajo — están para
  autorar cuando alguien tenga tiempo, no arrastran ningún problema urgente. `StatusTag` salió de
  esta lista (autorado en el sync de 2026-09-22, ver la sección de componentes genéricos). `AppShell`
  es floor card por una causa aparte al logo (crashea antes de llegar a renderizarlo, ver `firstErr`
  en `.render-check.json` si hace falta debuggearlo) — no confundir con el bug del logo de abajo.
- **`ThemeProvider` es de esta rama, no de `develop`** — si `feature/fundaciones-app` se mergea y
  alguien decide después que `ThemeProvider` no debería vivir en `apps/web`/`packages/ui` en
  producción (porque `apps/web/layout.tsx` arma su propio `ConfigProvider` a mano), avisar antes
  de borrarlo: sigue haciendo falta acá, para `cfg.provider`.
- **`docsDir` nunca se configuró** — los 32 `.prompt.md` se sintetizan solo desde `.d.ts` + JSDoc,
  ninguno matchea un doc real (`docs: 0/32 components matched`). Si en algún momento se arma
  documentación por componente, apuntar `cfg.docsDir`.
- **`cfg.buildCmd` (`npm run build:types --workspace=@rentar/ui`) es ahora obligatorio antes de
  cada sync** — ver la sección "Componentes genéricos" de abajo. Si se corre el converter sin
  regenerar `packages/ui/dist-types/` primero (o si ese directorio se borra y nadie lo regenera),
  el converter cae de vuelta al modo synth-desde-`src/`, que **silenciosamente vuelve a romper**
  `StatusTag`/`DataTable` (genérico sin clase `<...>`, `D`/`T` sueltos en el `.d.ts` — ver abajo).
  No hay ningún check automático que lo detecte; `resync.mjs` no corre `buildCmd` por vos, hay que
  correrlo a mano antes.
- **`cfg.dtsPropsFor.StatusTag`/`.DataTable` son uniones a mano, van a quedar desactualizadas
  solas** — si se agrega un dominio/estado nuevo a `packages/shared-types/src/status.ts`, o un
  campo nuevo a `DataTableColumn`, hay que actualizar el body de `dtsPropsFor` a mano (no hay forma
  de que el extractor lo derive automáticamente — ver la sección de abajo). Buscar
  `"StatusTag":` / `"DataTable":` en `.design-sync/config.json`.

## Componentes genéricos (`StatusTag<D>`, `DataTable<T>`) — por qué necesitan `dtsPropsFor`

Investigado a fondo en el sync de 2026-09-22 (pedido: "el card de StatusTag cae al fallback").
Root cause real, dos capas:

1. **Sin un `.d.ts` real compilado, el converter usa el modo synth-desde-`src/`** (porque
   `package.json` de `@rentar/ui` tiene `"types": "src/index.ts"` — código fuente, no un build).
   En synth mode, `propsBodyFor` (`.ds-sync/lib/dts.mjs`) nunca encuentra la interfaz `<Name>Props`
   como declaración nombrada (el `Project` de ts-morph solo carga el barrel `src/index.ts`, no cada
   `.tsx`) y cae a un fallback que **fuerza `generics: ''` sin importar si el componente es
   genérico** — de ahí `export interface StatusTagProps { domain: D; ... }` con `D` suelto (ni
   siquiera es el bug de "generic sin default" que sugería el pedido original — pasa igual con o
   sin default).
   **Fix**: se agregó `packages/ui/package.json#publishConfig.types` apuntando a
   `dist-types/index.d.ts` (un build de solo-declaraciones, `npm run build:types`, sin tocar
   `main`/`types` que sigue usando `apps/web`) + `cfg.buildCmd` en la config. `findTypesRoot`
   prefiere `publishConfig.types` sobre `types` — con esto el converter encuentra la interfaz real
   y SÍ preserva la cláusula `<D extends StatusDomain = StatusDomain>`.
2. **Aún con un `.d.ts` real, un genérico cuyos miembros referencian un tipo nombrado de OTRO
   paquete no queda resuelto** — `StatusDomainMap` (de `@rentar/shared-types`) nunca se importa en
   el `.d.ts` aplanado que emite el converter (solo agrega `import * as React from 'react'`, nada
   más), así que `status: StatusDomainMap[D]` queda como referencia colgante igual, aunque el
   `<D...>` de la interfaz ahora sí esté. Esto parece ser una limitación real del converter con
   genéricos + tipos externos, no algo resoluble solo con `publishConfig`.
   **Fix**: `cfg.dtsPropsFor.StatusTag`/`.DataTable` — body a mano con la unión ya resuelta a texto
   literal (mismo criterio que "types are fully resolved into body" que ya usa el converter para
   props que SÍ son unions). Pierde la correlación real domain↔status (en el componente real,
   `domain="propiedad"` limita `status` a `PropertyStatus`; en el `.d.ts` aplanado, `status` acepta
   cualquier string de cualquier dominio) — degradación aceptada y documentada, igual que el resto
   de "generics ... resolve to their structural shape" en los Known Limitations del skill.

**Si aparece el mismo síntoma en otro componente genérico nuevo**: primero confirmar que
`packages/ui/dist-types/` existe y está actualizado (`npm run build:types --workspace=@rentar/ui`)
y que el `.d.ts` ahí SÍ tiene la cláusula `<...>` — si la tiene pero el converter igual la pierde,
es la causa (2) y hace falta `dtsPropsFor`; si no la tiene ahí tampoco, revisar que
`publishConfig.types` siga apuntando bien.

## Logo roto en el bundle (`logo.src` undefined) — arreglado 2026-09-22

`packages/ui/src/assets/logo-rentar.svg` se importaba directo (`import logo from
'./logo-rentar.svg'`) y se leía como `logo.src`/`logo.width`/`logo.height` — funciona en Next
(devuelve `StaticImageData`), pero el build de esbuild de `/design-sync` usa el loader `dataurl` y
devuelve un string plano, así que `logo.src` quedaba `undefined` en 6 lugares (`AppShell` ×2,
`AuthLayout`, `Header` ×2, `Footer`) y el `<img>` salía sin fuente en las cards. Se agregó
`packages/ui/src/assets/logo.ts` (`LOGO.{src,width,height}`, normaliza los dos formatos — el
fallback de tamaño, 202×113, sale del `viewBox` del SVG) y los 6 usos leen de ahí. Verificado con
capturas del render check: el logo se ve bien en `Header`/`Footer`/`AuthLayout` (no son floor card,
así que es el render real). Es el único asset importado así en el paquete — si se agrega uno
nuevo con el mismo patrón (`import x from './algo.svg'` + `.src`), aplicar el mismo helper.
