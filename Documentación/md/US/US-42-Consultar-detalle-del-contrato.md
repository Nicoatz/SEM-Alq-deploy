| **Consultar detalle del contrato** |
| - |
| Como locador, quiero consultar el detalle de un contrato para conocer sus condiciones y el estado de las firmas. |
| **Criterios de aceptación:** |
| *Acceso* |
| - Se debe haber iniciado sesión con el usuario locador dueño del contrato. |
| - Se accede desde el listado de contratos, en /panel/contratos/[id]. |
| - Si el contrato no existe o no es del usuario, se debe mostrar "No encontramos este contrato", sin distinguir entre los dos casos. |
| - Un borrador no tiene detalle: al abrirlo se retoma en el alta (US-06). |
| *Encabezado* |
| - Se debe mostrar el código del contrato, la dirección de la propiedad, el nombre del locatario, el estado y la vigencia. |
| - Se deben mostrar las acciones disponibles según el estado: modificar y firmar si está pendiente de firma (US-06 y US-07), y descargar el PDF en cualquier estado. |
| *Datos del contrato* |
| - Se deben mostrar la propiedad, el locador, el locatario (nombre, apellido, DNI, correo y teléfono) y los garantes (nombre y apellido, DNI y correo). |
| - Se deben mostrar las condiciones: fecha de inicio y de fin, duración, monto inicial, monto actual, depósito, día de vencimiento del pago, índice y periodicidad de ajuste, y las condiciones de cobro de la propiedad. |
| - Se debe mostrar el acceso a la solicitud de origen. |
| - Los datos que no estén registrados (por ejemplo, en contratos anteriores a RentAR) se deben mostrar como "Sin dato". |
| *Calendario de ajustes* |
| - Se deben mostrar la fecha de inicio y las fechas de cada ajuste, con su índice. |
| - El monto de los ajustes futuros se debe mostrar como "a definir". |
| - Si el contrato es "Sin ajuste", no se muestra el calendario. |
| *Firmas* |
| - Se debe mostrar el estado de cada firmante: pendiente, firmado (con fecha y hora) o rechazado (con el motivo). |
| - Mientras esté pendiente de firma, se debe indicar cuántas firmas faltan. |
| - Con el contrato vigente, se debe mostrar "Firmado por todas las partes el dd/mm/aaaa". |
| - Si no hay registro de las firmas (contratos anteriores a RentAR), se debe indicar así, sin inventar los datos. |
| *Documento* |
| - Se debe mostrar el documento del contrato paginado, con sus cláusulas. |
| - Se debe poder descargar el contrato en PDF en cualquier estado. |
| **Pruebas de usuario:** |
| - Probar consultar el detalle sin haber iniciado sesión (falla). |
| - Probar consultar por URL el contrato de otro locador y verificar que se muestre "No encontramos este contrato" (pasa). |
| - Probar consultar por URL un contrato inexistente y verificar que se muestre el mismo mensaje (pasa). |
| - Probar abrir un borrador y verificar que se retome en el alta (pasa). |
| - Probar consultar un contrato pendiente de firma y verificar el código, el estado, la cantidad de firmas que faltan y el estado de cada firmante (pasa). |
| - Probar consultar un contrato con una firma rechazada y verificar que se muestre el motivo (pasa). |
| - Probar consultar un contrato vigente y verificar "Firmado por todas las partes" con la fecha, y que no se ofrezca modificar ni firmar (pasa). |
| - Probar verificar que se muestren todas las condiciones, las partes y los garantes (pasa). |
| - Probar consultar un contrato con ICL semestral y verificar las fechas de ajuste con sus montos "a definir" (pasa). |
| - Probar consultar un contrato sin ajuste y verificar que no se muestre el calendario (pasa). |
| - Probar consultar un contrato anterior a RentAR y verificar que los datos faltantes digan "Sin dato" y que se indique que no hay registro de las firmas (pasa). |
| - Probar recorrer las páginas del documento (pasa). |
| - Probar descargar el PDF de un contrato pendiente de firma y de uno vigente (pasa). |
