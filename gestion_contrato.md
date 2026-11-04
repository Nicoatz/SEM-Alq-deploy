# Gestión de contratos (ABM) — plan de trabajo

Cubre: US-05 (Registrar contrato de alquiler) y lo que de ella depende.
Estado de este documento: **borrador de trabajo**. Se va completando a medida que se desarrolla cada paso.

## 1. Decisiones tomadas

1. **Dos filas por inmueble en `contrato`, con roles distintos.**
   - **Oferta** (estado 1, `disponible`): ficha comercial de la publicación. Se crea al publicar la
     propiedad (`registrar_propiedad_completa`). Existe siempre y una sola por inmueble. "Iniciar
     contrato" **no la toca**.
   - **Contrato en curso**: fila nueva que se crea al hacer "Iniciar contrato". Lleva locatario,
     garantes, fechas reales, monto negociado, cláusulas y código CT-AAAA-NNNN.
2. **La publicación (listado y detalle público) siempre lee la oferta** (`estado = 1`), nunca el
   contrato en curso. Así el precio público no cambia mientras se negocia.
3. **`inmueble.estado_alquiler`:** no cambia mientras el contrato está en borrador o pendiente de
   firma (US-05: "la propiedad sigue publicada"). Pasa a **`alquilado`** cuando el contrato queda
   vigente (siempre). `publicado/alquilado` queda solo para cuando el locador lo elige a mano.
4. **Al finalizar el contrato la propiedad pasa a `pausado`**, para que el locador pueda modificar
   lo que necesite antes de republicar. La oferta queda intacta.
5. **Los garantes no son usuarios registrados, pero firman.** Van en una tabla propia `garante`
   (no en `contrato_x_usuario`), con los datos de identidad, el contrato asociado y los datos de su
   firma. Firman por un enlace, sin cuenta. No hay servicio de correo integrado: el enlace se
   **muestra en pantalla** al locador y él se lo hace llegar al garante por el medio que prefiera
   (WhatsApp, etc.).
6. **`contrato.dias_para_vencimiento` (US-27) es el día de vencimiento del pago.** Se reutiliza
   para el "día de vencimiento" de la US-05; no se crea otra columna.
7. Los cambios de estado de contrato e inmueble se hacen **en la misma transacción** (función SQL,
   como `registrar_propiedad_completa`).

## 2. Estados

`estado_contrato`:

| id | descripción | nota |
|---|---|---|
| 1 | disponible | la oferta |
| 2 | vigente | firmaron todos |
| 3 | finalizado | |
| 4 | pendiente de firma | ya existe (migración `20261021120000`) |
| 5 | borrador | **a crear** (lo pide la US-05) |

Transiciones del contrato en curso y efecto en el inmueble:

| Evento | Contrato en curso | Oferta | `estado_alquiler` |
|---|---|---|---|
| Alta de la propiedad | no existe | 1 | `publicado` |
| Iniciar contrato | 5 borrador | sin cambios | sin cambios |
| Enviar a firmar | 4 pendiente de firma | sin cambios | sin cambios |
| Firman todos | 2 vigente | sin cambios | `alquilado` |
| Firma rechazada / se cae | 3 finalizado o descartado | sin cambios | sin cambios |
| Fin del contrato | 3 finalizado | sin cambios | `pausado` |

## 3. Pendientes de decisión

- [x] ~~¿Sigue vigente el UNIQUE de `contrato.id_inmueble`?~~ **Sí** (verificado en Supabase el
      02/11/2026: constraint `contrato_id_inmueble_key`). La migración lo reemplaza. El comentario
      de `contrato.repository.ts` sobre "historial de varios contratos" no se cumplía hoy.
- [ ] **Cómo firma el garante sin cuenta:** enlace con token de un solo uso y vencimiento, que se
      muestra en pantalla. Definir la duración del token y cómo se genera un enlace nuevo si vence
      o se pierde (el nuevo invalida el anterior).
- [ ] **Quién ve el enlace del garante:** el locador, en el detalle del contrato pendiente de firma.
      Confirmar si el locatario también.
- [ ] **`dias_para_vencimiento` ya existe con `CHECK > 0`.** La US-05 exige 1 a 28: ajustar la
      restricción (verificar antes que ningún dato existente la incumpla). El nombre es engañoso
      (parece "días hasta"), pero renombrarlo obligaría a tocar el código de US-27: se deja y se
      documenta con un comentario.
- [x] ~~Verificar `actualizar_propiedad_completa`~~: solo bloquea `alquilado` y
      `publicado/alquilado`, así que **se puede editar en `pausado`**. Tampoco toca la tabla
      `contrato`, por lo que no se ve afectada por las dos filas.
- [x] **Resuelto (04/11, `20261104000001_us03_modificar_oferta`): editar la propiedad actualiza también la oferta; ambos montos se mantienen iguales.** Observación previa: al editar `precio_publicado` de una propiedad
      no se actualiza `contrato.monto_alquiler` de la oferta, y la publicación muestra el segundo.
      Decidir si la edición de la propiedad debe actualizar también la oferta.
- [ ] **Baja de propiedad con contrato en curso:** se decidió bloquearla (409) si hay un contrato
      pendiente de firma; un borrador se finaliza junto con la propiedad. Confirmar con el equipo.

## 4. Pasos de desarrollo

### Paso 1 — Verificar el esquema real
- [x] Revisado en Supabase (02/11/2026): el UNIQUE de `id_inmueble` sigue; `contrato` tiene las
      columnas de las migraciones (incluye `activo` y las de US-27); `estado_contrato` llega
      hasta el 4; no hay inmuebles con más de un contrato; hay 22 contratos y todos tienen
      `dias_para_vencimiento` nulo (se puede acotar el `CHECK` sin perder datos).
- [x] Cerrados los pendientes que bloqueaban la migración.

### Paso 2 — Migración de base de datos
Escrita en `supabase/migrations/20261102000000_us05_gestion_contrato.sql` y **aplicada en
Supabase el 02/11/2026**. Verificado: el estado 5 existe y los 22 inmuebles tienen su oferta
(estado 1). Los inmuebles 1, 23 y 24 (contrato finalizado) están dados de baja, así que no
reaparecen en el listado. Dato de prueba inconsistente: el inmueble 2 está `alquilado` con un
contrato pendiente de firma (la regla nueva dice que `alquilado` es solo con contrato vigente).
Incluye además la creación de la oferta de los
inmuebles existentes que no la tienen, porque hasta ahora la única fila hacía de oferta y de
contrato.
- [ ] Agregar estado 5 `borrador` a `estado_contrato`.
- [ ] Reemplazar `UNIQUE (id_inmueble)` por índices únicos parciales:
  - una sola oferta por inmueble: `UNIQUE (id_inmueble) WHERE estado = 1`;
  - un solo contrato en curso por inmueble: `UNIQUE (id_inmueble) WHERE estado IN (2, 4, 5)`.
- [ ] Columnas nuevas en `contrato`:
  - `codigo` (CT-AAAA-NNNN, UNIQUE, nulo en borrador);
  - `id_solicitud` (FK a `solicitud`, UNIQUE): una solicitud origina un solo contrato y permite
    mostrar la solicitud de origen y sus garantías;
  - `ultimo_paso_borrador` (1 a 4, nulo fuera de borrador).
- [ ] Tabla `clausula_contrato`: `id_contrato` (FK CASCADE), `orden`, `titulo`, `texto`
      (`CHECK char_length <= 1000`), `tipo` (`fija` / `editable` / `propia`), `editada`.
- [ ] Cambiar el `CHECK` de `dias_para_vencimiento` a `BETWEEN 1 AND 28` (US-05).
- [ ] Tabla `garante`:
  - identidad: `id_contrato` (FK CASCADE), `nombre`, `apellido`, `dni`
    (`CHECK ~ '^[0-9]{7,8}$'`), `email`;
  - unicidad: `UNIQUE (id_contrato, dni)` y `UNIQUE (id_contrato, lower(email))`;
  - firma, con la misma forma que `contrato_x_usuario` (US-27): `estado_firma`
    (`pendiente` / `firmado` / `rechazado`), `fecha_firma`, `hash_documento_firmado`, `ip_firma`,
    `fecha_rechazo`, `motivo_rechazo`;
  - acceso por enlace: `token_firma_hash` (se guarda el hash, nunca el token) y
    `token_vence_en`;
  - máximo 3 por contrato y "no ser locador ni locatario" se validan en la función SQL.

### Paso 3 — Ajustar lo que hoy asume una sola fila por inmueble
Auditoría hecha el 02/11/2026. Resultado por endpoint:

| Qué | Efecto de tener 2 filas | Estado |
|---|---|---|
| `GET /inmuebles/disponibles` (`buscarDisponibles`) | el filtro `neq estado 3` habría tomado el contrato en curso para precio e índice | [x] ahora `eq estado 1` |
| `GET /inmuebles/:id` (detalle) | `findByInmuebleId` devolvía la fila más nueva (el contrato en curso) | [x] usa `findOfertaByInmuebleId` |
| Listado `disponibles` (armado del item) | ídem | [x] usa `findOfertaByInmuebleId` |
| "Mis alquileres" del locador (`getMisInmueblesPublicados`) | mezclaba oferta y contrato | [x] contrato si está vigente; si no, la oferta |
| `eliminar_inmueble_logico` (US-04) | finalizaba todos los contratos sin mirar estado | [x] bloquea si hay uno pendiente de firma (en la migración) |
| `actualizar_propiedad_completa` | no toca `contrato` | sin cambios |
| US-27 Alquileres del locatario | filtra por estados 4, 2 y 3 y por `contrato_x_usuario`; la oferta no entra | sin cambios |
| `tieneContratoQueBloqueaEdicion` (editar usuario) | consulta estados 2 y 4 vía `contrato_x_usuario`; la oferta no tiene usuarios | sin cambios (el borrador no bloquea) |
| `registrar_propiedad_completa` | crea la oferta (estado 1) | sin cambios |

- [x] `contrato.repository.ts`: `findByInmuebleId` se reemplazó por `findOfertaByInmuebleId` y
      `findEnCursoByInmuebleId`, con constantes `ESTADO_CONTRATO`.
- [ ] Validación "sin contrato vigente ni pendiente": sumar el estado 5 (se hace en el Paso 4).
- [ ] Probar los endpoints anteriores contra la base con la migración aplicada.

### Paso 4 — Iniciar contrato (crear borrador)
Código listo, **falta aplicar la migración** `20261102000001_us05_iniciar_contrato.sql` y probarlo
contra la base.
- [x] Función SQL `iniciar_contrato(p_id_solicitud, p_id_locador)`: crea la fila en estado 5 en
      una transacción, copia los medios de pago de la oferta y deja las dos partes en
      `contrato_x_usuario`. Solo `service_role` puede ejecutarla.
- [x] `POST /api/v1/contratos` con `{ id_solicitud }` → 201 con el borrador. Rol locador.
      Archivos: `contratos.routes.ts`, `contrato.controller.ts`, `contrato.service.ts` y
      `iniciarContrato` en `contrato.repository.ts`. Tests: `contrato.service.unit.test.ts`.
- [x] Reglas (todas en el SQL): la solicitud es del locador (si no, 404); está aceptada (409);
      no originó otro contrato (409); la propiedad existe y está activa (404); no tiene
      contrato vigente, pendiente ni en borrador (409); tiene oferta cargada (409).
- [x] Valores por defecto de la US-05: duración 24 meses, depósito = un mes de alquiler,
      vencimiento el día 10, monto = el de la oferta (lo que está publicado); índice,
      frecuencia, interés y días de gracia, de la oferta. `ultimo_paso_borrador = 1`.
- [ ] Aplicar la migración y probar: solicitud aceptada (201), pendiente (409), repetida (409),
      ajena (404), propiedad con contrato en curso (409).
- [ ] Documentar el endpoint en `docs/api-endpoints.md` y `docs/HANDOFF-BACKEND.md`.

### Paso 5 — Guardar borrador por pasos
Código listo (`GET` y `PATCH /contratos/:id`), **falta aplicar** la migración
`20261102000002_us05_guardar_borrador.sql` y probarlo. Detalle en
[`registrar_contrato_desarrollo.md`](registrar_contrato_desarrollo.md), secciones 5 y 6.
Decisiones (02/11/2026): **el back manda y el front se adapta**; las cláusulas se guardan tal como
llegan (la plantilla está en el front) y las fijas ya guardadas no se pueden modificar; el garante
**firma por enlace**, pero eso se hace con la firma (US-07), después del registro.
- [x] Endpoint de actualización parcial (pasos 1 a 3 de la US-05), con `ultimo_paso_borrador`.
- [ ] Garantes: hasta 3, DNI y correo válidos y sin repetir, distintos del locador y el locatario.
- [ ] Condiciones: fecha de inicio no anterior a hoy, duración entera > 0 (24 por defecto), fecha
      de fin calculada, monto entero > 0 (precarga el precio publicado), depósito >= 0, día de
      vencimiento 1 a 28, índice y periodicidad.
- [ ] Cláusulas: generar desde la plantilla, editar las editables, agregar y quitar las propias.

### Paso 6 — Enviar a firmar
- [ ] Función SQL: valida todo lo obligatorio, asigna el código CT-AAAA-NNNN y pasa a estado 4.
- [ ] Generar el PDF y guardar `pdf_storage_path` y `pdf_sha256`.

### Paso 7 — Firma y vigencia
- [ ] Enviar a firmar genera un token por garante y la pantalla muestra su enlace para copiarlo y
      compartirlo (sin correo). Endpoint para regenerar el enlace de un garante que no firmó.
- [ ] Endpoint público (sin sesión) para que el garante vea el contrato y firme o rechace con su
      token.
- [ ] Cuando firman todos (locador, locatario y garantes): contrato a 2 e inmueble a `alquilado`,
      en la misma transacción.
- [ ] Rechazo o vencimiento de la firma: contrato a 3, sin tocar el inmueble.

### Paso 8 — Finalización
- [ ] Contrato a 3 e inmueble a `pausado`, en la misma transacción.

### Paso 9 — Consultar, descartar y listar
- [ ] Obtener un contrato, listar los del locador y descartar un borrador.

### Paso 10 — Frontend
- [ ] Service y adaptador en `apps/web/src/services/` (con rama mock y rama real), siguiendo las
      convenciones de `CLAUDE.md`.
- [ ] Alta en 4 pasos con aviso al salir con cambios sin guardar, y `data-testid` en las acciones.

### Paso 11 — Documentación y pruebas
- [ ] Documentar los endpoints en Swagger y en `docs/api-endpoints.md`, y el estado en
      `docs/HANDOFF-BACKEND.md`.
- [ ] Probar los casos de la sección "Pruebas de usuario" de la US-05.
