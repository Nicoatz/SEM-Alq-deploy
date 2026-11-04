# Registrar contrato (US-05) — documentación técnica del desarrollo

Cómo funciona el registro de un contrato en el back, qué se cambió en la base y en la API, y por qué
cada propiedad tiene **dos contratos**: la oferta y el contrato en curso.

Para integrar desde el front: [`registrar_contrato_front.md`](registrar_contrato_front.md). Contrato de
la API: [`api-endpoints.md`](api-endpoints.md), sección "Contratos".

## 1. El modelo: dos contratos por propiedad

La tabla `contrato` guardaba a la vez las **condiciones de la publicación** (precio, expensas, índice)
y el **contrato de alquiler**, con `id_inmueble` único: una sola fila por propiedad. Si al negociar se
cambiaba el monto, cambiaba también el precio público; y un contrato pendiente de firma no podía
convivir con la propiedad publicada.

Ahora son **dos filas con roles distintos**:

| | Oferta | Contrato en curso |
|---|---|---|
| **Qué es** | La ficha comercial de la publicación | Lo que se negocia, se firma y rige el alquiler |
| **Cuándo se crea** | Al publicar la propiedad | Al iniciar el contrato desde una solicitud aceptada |
| **Estado** | `1` disponible, siempre | `5` borrador → `4` pendiente de firma → `2` vigente → `3` finalizado |
| **Cuántas hay** | Una por propiedad | Una en curso por propiedad (las finalizadas quedan de historial) |
| **Quién la lee** | La publicación (listado y detalle) | El alta de contrato y "Mis alquileres" cuando está vigente |
| **¿Se modifica al negociar?** | No, nunca | Sí, es el borrador de trabajo |

```
 PUBLICAR PROPIEDAD                    INICIAR CONTRATO
        │                                     │
        ▼                                     ▼
 ┌──────────────┐   se copia como    ┌────────────────────┐
 │   OFERTA     │ ─────────────────► │ CONTRATO EN CURSO  │
 │  estado 1    │   punto de partida │  estado 5 borrador │
 │  (no cambia) │                    │  (se edita acá)    │
 └──────┬───────┘                    └─────────┬──────────┘
        ▼                                      ▼
  Lo que ve el público              Lo que ve el locador y el
  (listado y detalle)               locatario al negociar y firmar
```

Se garantiza con **índices únicos parciales**: una oferta por inmueble (`estado = 1`) y un contrato en
curso por inmueble (`estado IN (2, 4, 5)`).

**Por qué sirve:**
- El precio público no cambia mientras se negocia un contrato.
- Si la firma se cae, no hay nada que restaurar: se descarta el contrato en curso y la oferta sigue igual.
- Cuando el contrato termina, la propiedad vuelve con **la misma oferta**.
- No toca US-01, US-02 ni US-03: las condiciones de la publicación siguen donde estaban.

### Qué le pasa a la propiedad (`inmueble.estado_alquiler`)

| Evento | Contrato en curso | Oferta | Propiedad |
|---|---|---|---|
| Se publica la propiedad | no existe | estado 1 | `publicado` |
| Iniciar contrato | estado 5 borrador | sin cambios | sin cambios |
| Enviar a firmar | estado 4 | sin cambios | sin cambios (sigue publicada) |
| Firman todos | estado 2 vigente | sin cambios | `alquilado` |
| Termina el contrato | estado 3 finalizado | sin cambios | `pausado` (el locador ajusta lo que necesite y republica) |

`publicado/alquilado` es solo para cuando el locador lo elige a mano. Las transiciones de "Enviar a
firmar" en adelante pertenecen al flujo de firma (US-07) y no son parte del registro.

## 2. Las rutas

Todas con Bearer y rol `locador`. Swagger: `http://localhost:3000/api/v1/docs`, sección **Contratos**.

| Ruta | Qué hace |
|---|---|
| `POST /contratos` | Inicia el contrato: crea el borrador desde una solicitud aceptada |
| `GET /contratos/:id` | Devuelve el contrato completo (para retomar el borrador) |
| `PATCH /contratos/:id` | Guarda garantes y condiciones (y el paso) |
| `POST /contratos/:id/pdf/url-subida` | Entrega una URL firmada para subir el PDF directo a Storage |
| `PUT /contratos/:id/pdf` | Registra el PDF ya subido |
| `POST /contratos/:id/reabrir` | US-06: vuelve a borrador un contrato pendiente de firma sin la firma del locatario |
| `DELETE /contratos/:id` | US-06: descarta un borrador y libera la solicitud |

### 2.1 Iniciar el contrato: `POST /contratos`

Body `{ "id_solicitud": 8 }`. Todo lo hace la función SQL `iniciar_contrato`, **en una transacción** (o se
crea todo o nada):

1. Bloquea la solicitud, para que dos clics seguidos no creen dos contratos.
2. Valida las reglas de la US-05 (tabla de abajo).
3. Lee la **oferta** y crea el contrato en curso con sus valores por defecto.
4. Copia los medios de pago de la oferta.
5. Registra a las dos partes en `contrato_x_usuario`: locador (`tipo_firmante = 1`) y locatario (`2`).

| Situación | Respuesta |
|---|---|
| Todo correcto | **201** (la fila creada, `estado: 5`) |
| `id_solicitud` ausente, no entero o menor a 1 | 400 |
| Sin sesión / el usuario no es locador | 401 / 403 |
| La solicitud no existe o es de otro locador (no se revela cuál) | 404 |
| La propiedad no existe o está dada de baja | 404 |
| La solicitud no está aceptada | 409 |
| La solicitud ya originó un contrato | 409 |
| La propiedad ya tiene un contrato vigente, pendiente de firma o en borrador | 409 |
| La propiedad no tiene oferta cargada | 409 |

Los **409 traen un `codigo`** en el sobre de error (`{ success, message, error, codigo }`), así el cliente
no depende del texto del mensaje:

| Caso | `codigo` |
|---|---|
| Solicitud no aceptada | `SOLICITUD_NO_ACEPTADA` |
| La solicitud ya originó un contrato | `SOLICITUD_CON_CONTRATO` |
| La propiedad ya tiene un contrato en borrador | `PROPIEDAD_CON_BORRADOR` |
| La propiedad ya tiene un contrato vigente o pendiente de firma | `PROPIEDAD_CON_CONTRATO` |
| La propiedad no tiene oferta cargada | `PROPIEDAD_SIN_OFERTA` |
| Dos pedidos simultáneos | `CONTRATO_DUPLICADO` |
| El contrato ya no está en borrador (`PATCH`, `url-subida`, `PUT /pdf`, `DELETE`) | `CONTRATO_NO_EDITABLE` |
| `reabrir`: el contrato está vigente | `CONTRATO_VIGENTE` |
| `reabrir`: el contrato está finalizado | `CONTRATO_FINALIZADO` |
| `reabrir`: el locatario ya firmó (o dio su conformidad) | `CONTRATO_FIRMADO_POR_LOCATARIO` |
| `reabrir`: el contrato ya está en borrador | `CONTRATO_YA_EN_BORRADOR` |

Las funciones SQL devuelven el `codigo` y la API lo pasa tal cual; `error.middleware.ts` lo incluye en el
sobre cuando el error lo trae.

Valores con los que nace el borrador (US-05, paso 2):

| Campo | Valor |
|---|---|
| Monto de alquiler | El de la oferta (lo que está publicado) |
| Expensas, índice, interés por día, días de gracia | Los de la oferta |
| Frecuencia de ajuste | La de la oferta si es trimestral, semestral o anual (en minúsculas); si no, vacía |
| Duración | 24 meses |
| Depósito | Un mes de alquiler (igual al monto) |
| Plazo de vencimiento del pago (`dias_para_vencimiento`) | 10 días |
| Medios de pago | Los de la oferta |
| Fechas de inicio y de fin | Vacías: las carga el locador |
| Código `CT-AAAA-NNNN` | Vacío: se asigna al enviar a firmar |
| Último paso | 1 |

### 2.1.1 Modificar y descartar (US-06)

Un contrato pendiente de firma se modifica **volviéndolo a borrador** y editándolo con el `PATCH` de
US-05: no hay una edición aparte. La propiedad y el locatario no se pueden cambiar (el `PATCH` responde
400 si llegan `id_inmueble`, `locatario`, `id_solicitud`, etc.). El cliente pide la confirmación al locador
antes de llamar a cualquiera de las dos rutas.

**`POST /contratos/:id/reabrir`** (función SQL `reabrir_contrato`, en una transacción):
1. Bloquea el contrato y verifica que sea del locador (si no, 404 sin distinguir).
2. Rechaza con 409 si está vigente, finalizado, ya en borrador o si el locatario ya firmó o dio su
   conformidad (esa conformidad no se puede borrar: lo impide un trigger de US-27).
3. Borra las firmas de las partes y de los garantes y anula los enlaces de firma de los garantes.
4. Pasa a estado 5 (borrador), con `ultimo_paso_borrador = 1`, y **conserva el código** CT-AAAA-NNNN.
5. Responde 200 con el contrato completo (`ContratoBorradorResponse`). La propiedad y la oferta no cambian.

**`DELETE /contratos/:id`** (función SQL `descartar_borrador_contrato`): solo borradores (409
`CONTRATO_NO_EDITABLE` si no). Borra el contrato y, en cascada, sus garantes, medios de pago y partes; la API
borra el PDF de Storage. Como `id_solicitud` es único, al desaparecer el borrador la solicitud aceptada puede
originar un contrato nuevo.

`GET /contratos/:id` suma `fecha_inicio_vencida` (la fecha de inicio guardada ya pasó): hay que pedir una
nueva antes de volver a enviar a firmar (esa validación se aplica al enviar, US-07). En el detalle (US-42),
`acciones.modificar` es `false` si el locatario ya firmó.

### 2.2 Consultar: `GET /contratos/:id`

Devuelve el contrato con el inmueble, el locador y el locatario (de `usuario`), las garantías que el
locatario ofreció en la solicitud, los garantes, las condiciones (con los medios de pago, los días de
gracia y el interés de la publicación, en solo lectura), el PDF y el último paso. Un contrato ajeno,
inexistente o la oferta responden siempre **404**.

### 2.3 Guardar: `PATCH /contratos/:id`

Cada clave es opcional y solo se guarda lo que viene:

- `paso`: 1 a 4, el paso en que está el usuario.
- `condiciones`: `fecha_inicio_contrato`, `duracion_meses`, `monto_alquiler`, `deposito`,
  `dias_para_vencimiento`, `indice_aumento` (`null` = sin ajuste) y `frecuencia_ajuste`.
  La duración, el monto, el depósito, el plazo y la fecha de inicio aceptan `null`: el borrador se puede
  guardar incompleto (el monto es obligatorio para todo contrato que no sea un borrador).
- **`dias_para_vencimiento` es un plazo en días** (1 a 28): los días que tiene el locatario para pagar
  desde que el monto queda disponible. Es el mismo campo que usa `/alquileres-locatario` (US-27) para
  calcular el próximo vencimiento; no es el día del mes.
- `garantes`: la lista completa, que reemplaza a la anterior.

La respuesta es el contrato completo. Un borrador puede guardarse incompleto; lo obligatorio se exige
al enviar a firmar. Todo se guarda en una transacción, con la función SQL `guardar_borrador_contrato`.

| Regla (US-05) | Respuesta |
|---|---|
| Garantes: hasta 3; nombre, apellido, DNI (7 u 8 dígitos) y correo obligatorios; sin repetir DNI ni correo | 400 |
| Un garante no puede ser el locador ni el locatario (por DNI o correo) | 400 |
| Fecha de inicio `AAAA-MM-DD` y no anterior a hoy (hora de Córdoba) | 400 |
| Duración entera > 0; monto entero > 0; depósito entero ≥ 0; plazo de vencimiento de 1 a 28 días (todos aceptan `null`) | 400 |
| Periodicidad trimestral, semestral o anual; sin índice no se puede indicar | 400 |
| Índice de ajuste que no existe | 400 |
| Cuerpo vacío o sin ninguna clave reconocida | 400 |
| Contrato ajeno o inexistente | 404 |
| El contrato ya no está en borrador | 409 |

**Fecha de fin.** No se envía: la calcula la función SQL `calcular_fecha_fin_contrato`. Regla del PO:
inicio + N meses − 1 día; si el día de inicio no existe en el mes de destino (31/01 + 1 mes), el
contrato termina el último día de ese mes. Casos verificados dentro de la migración (01/10/2026 + 36
meses = 30/09/2029, 31/01/2027 + 1 mes = 28/02/2027, 29/02/2028 + 12 meses = 28/02/2029, entre otros).

### 2.4 Cargar el PDF (paso 3)

La US-05 pide el contrato como **PDF de hasta 5 MB**. La API se despliega en Vercel, cuyas funciones
aceptan cuerpos de hasta 4,5 MB, así que el archivo **no pasa por la API**:

1. **`POST /contratos/:id/pdf/url-subida`:** valida que el contrato sea del locador y siga en borrador, y
   entrega `{ path, token, url_firmada, tamano_maximo_bytes }` para el bucket privado `contratos-pdf`.
   Cada pedido genera una ruta nueva (`contrato-<id>/<uuid>.pdf`): subir un archivo nunca pisa el que ya
   está registrado.
2. **El navegador sube el archivo directo a Supabase Storage.** El bucket solo acepta `application/pdf` de
   hasta 5 MB.
3. **`PUT /contratos/:id/pdf`** con `{ path, nombre }`: la API **no confía en lo que declara el cliente**.
   Descarga el archivo y verifica que la ruta sea de este contrato, que no pase de 5 MB (413 si pasa) y
   que empiece con `%PDF-`. Calcula el SHA-256 y registra el PDF con la función SQL
   `registrar_pdf_contrato`, que además valida el dueño y el estado.

Qué pasa en cada caso:
- **PDF nuevo sobre uno existente:** lo reemplaza y la API borra el anterior de Storage.
- **Archivo inválido:** se elimina de Storage y se conserva el PDF que ya estaba.
- **El contrato dejó de ser borrador mientras tanto:** se elimina lo recién subido y responde 409.
- **PDF obligatorio:** al enviar a firmar el contrato tiene que tener PDF (US-05).

`pdf_storage_path` y `pdf_sha256` son las columnas que ya usaba US-27: el locatario recibe una URL
firmada de ese mismo archivo. En `GET` y `PATCH`, `pdf.url` es una URL firmada que vence a los 5
minutos, para la miniatura del paso 4 (la dibuja el front).

## 3. Qué se cambió

### Base de datos (`supabase/migrations/`)

| Migración | Qué hace |
|---|---|
| `20261102000000_us05_gestion_contrato` | Estado `5 borrador`. Reemplaza el `UNIQUE (id_inmueble)` por los índices parciales. Columnas `codigo`, `id_solicitud` (única) y `ultimo_paso_borrador` (1 a 4); `dias_para_vencimiento` pasa a 1–28. Crea la oferta de las propiedades que solo tenían una fila vigente, pendiente o finalizada. Tabla `garante`. La baja lógica de propiedades (`eliminar_inmueble_logico`) da 409 si hay un contrato pendiente de firma |
| `20261102000001_us05_iniciar_contrato` | Función `iniciar_contrato` |
| `20261102000002_us05_guardar_borrador` | Función `calcular_fecha_fin_contrato` y primera versión de `guardar_borrador_contrato` (con cláusulas, que después se quitaron) |
| `20261103000000_us05_contrato_pdf` | El paso 3 pasa de cláusulas a PDF: elimina `clausula_contrato`, agrega `pdf_nombre_original`, `pdf_tamano_bytes` (hasta 5 MB) y `pdf_subido_en`, limita el bucket `contratos-pdf` a `application/pdf` y 5 MB, reemplaza `guardar_borrador_contrato` sin cláusulas y crea `registrar_pdf_contrato` |
| `20261103000001_us05_borrador_nulos_y_codigos` | `monto_alquiler` acepta `NULL` solo en un borrador (`CHECK`: todo contrato que no sea borrador lo tiene). Documenta en la base que `dias_para_vencimiento` es un plazo en días. Reemplaza `iniciar_contrato`, `guardar_borrador_contrato` y `registrar_pdf_contrato` para que los 409 devuelvan `codigo` |
| `20261104000000_us06_modificar_contrato` | US-06: funciones `reabrir_contrato` y `descartar_borrador_contrato` |

Las funciones que escriben (`iniciar_contrato`, `guardar_borrador_contrato`, `registrar_pdf_contrato`)
devuelven un JSON `{ success, statusCode, message }` (y `codigo` en los 409) y solo las puede ejecutar la API (`service_role`),
no el navegador. La tabla `garante` guarda además las columnas de firma (estado, fecha, IP, hash y
token), que el registro todavía no usa.

### API (`apps/api/src/`)

| Archivo | Cambio |
|---|---|
| `repositories/contrato.repository.ts` | `findByInmuebleId` se reemplaza por `findOfertaByInmuebleId` y `findEnCursoByInmuebleId`. Nuevos: `iniciarContrato`, `guardarBorrador`, `findBorradorCompleto` y los del PDF (`findParaPdf`, `crearUrlSubidaPdf`, `descargarPdf`, `eliminarPdf`, `registrarPdf`). Constantes `ESTADO_CONTRATO` |
| `services/contrato.service.ts` (nuevo) | Valida sesión, rol e id, orquesta las funciones SQL y Storage, y traduce cada resultado a su status HTTP |
| `services/contrato-borrador.validacion.ts` (nuevo) | Validación de formato de garantes y condiciones (funciones puras) |
| `services/contrato-pdf.validacion.ts` (nuevo) | Validación de la ruta, el nombre y el contenido del PDF (funciones puras) |
| `controllers/contrato.controller.ts` (nuevo) | Valida el id y el body, y responde |
| `routes/v1/contratos.routes.ts` (nuevo) | Las rutas de contratos (US-05 y US-06), con Swagger. Se registra en `routes/v1/index.ts` |
| `dtos/contrato.dto.ts` | Tipos de las rutas de contratos |
| `gateway/middlewares/error.middleware.ts` | El sobre de error incluye `codigo` cuando el error lo trae |
| `repositories/inmueble.repository.ts`, `services/inmueble.service.ts` | El listado y el detalle públicos leen la oferta; "Mis alquileres" usa el contrato si está vigente y, si no, la oferta |

`packages/shared-types`: el tipo `Contrato` suma `codigo`, `id_solicitud`, `ultimo_paso_borrador`,
`dias_para_vencimiento`, `activo` y los datos del PDF.

## 4. Endpoints existentes que se vieron afectados

Tener más de una fila por propiedad podía romper estos endpoints; ya están ajustados:

| Endpoint | Problema | Solución |
|---|---|---|
| Listado `disponibles` | Habría tomado el precio del contrato en negociación | Filtra solo la oferta |
| Detalle de propiedad | Devolvía la fila más nueva (el contrato en curso) | Lee la oferta |
| "Mis alquileres" del locador | Mezclaba las dos filas | Contrato si está vigente; si no, la oferta |
| Baja de propiedad (US-04) | Finalizaba todos los contratos sin mirar su estado | Bloquea con 409 si hay uno pendiente de firma |

No cambian: la edición de propiedad, los alquileres del locatario (US-27) y la edición de usuario.

## 5. Cómo probarlo

Hace falta una solicitud **aceptada** de una propiedad **sin contrato en curso**:

```sql
select s.id as id_solicitud, s.id_inmueble, s.id_locador
from solicitud s
where s.id_estado_solicitud = 2
  and not exists (select 1 from contrato c where c.id_solicitud = s.id)
  and not exists (
    select 1 from contrato c
    where c.id_inmueble = s.id_inmueble and c.estado in (2, 4, 5) and c.activo
  );
```

Con el token del locador (`Authorization: Bearer <token>`):

1. `POST /contratos` con `{ "id_solicitud": <id> }` → 201. Verificar en la base que hay dos filas para el
   inmueble (la oferta, estado 1, y el borrador, estado 5) y dos partes en `contrato_x_usuario`.
2. `GET /contratos/<id>` → el borrador completo.
3. `PATCH /contratos/<id>` con condiciones, p. ej. `{"paso":2,"condiciones":{"fecha_inicio_contrato":
   "2026-12-01","duracion_meses":36}}` → `fecha_fin_contrato = 2029-11-30`.
4. `PATCH` con garantes; probar como garante el DNI del locatario (400).
5. `POST /contratos/<id>/pdf/url-subida`, subir un PDF a la `url_firmada` (`PUT`, header
   `Content-Type: application/pdf`, body binario) y `PUT /contratos/<id>/pdf` con el `path` y el
   `nombre` → 200 con `pdf.url`.
6. Rechazos: un `path` de otro contrato (400), un archivo que no se subió (400), un texto renombrado a
   `.pdf` (400 y se borra de Storage), un PDF de más de 5 MB (lo rechaza Storage al subir).
7. Reemplazar: repetir el paso 5 con otro PDF; en `contratos-pdf` tiene que quedar un solo archivo de
   `contrato-<id>/`.
8. Para ver el 409, pasar el contrato a estado 4 en SQL y repetir un `PATCH`.

Para repetir las pruebas: `delete from contrato where id = <id>` (borra en cascada garantes, medios de
pago y partes; el PDF queda en Storage) deja la solicitud libre de nuevo.
