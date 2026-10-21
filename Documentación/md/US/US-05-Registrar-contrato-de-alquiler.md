| **Registrar contrato de alquiler** |
| - |
| Como locador, quiero registrar un contrato de alquiler a partir de una solicitud aceptada, indicando sus condiciones, índice de ajuste y garantes, para formalizar el alquiler con el locatario. |
| **Criterios de aceptación:** |
| *Acceso e inicio* |
| - Se debe haber iniciado sesión con el usuario locador dueño de la propiedad. |
| - Se debe poder iniciar el contrato desde una solicitud aceptada (botón "Iniciar contrato"), con la propiedad y el locatario precargados. |
| - La propiedad no debe tener un contrato vigente ni pendiente de firma. |
| - Una solicitud aceptada puede originar un solo contrato. |
| - El alta se realiza en 4 pasos (Partes y garantes, Condiciones, Cláusulas y Revisión). Se debe mostrar el paso actual y se puede volver a los pasos anteriores sin perder lo cargado. |
| *Paso 1 · Partes y garantes* |
| - Se deben mostrar los datos del locador y del locatario (nombre, apellido, DNI, correo y teléfono) sin poder modificarlos. |
| - Se debe mostrar el acceso a la solicitud de origen. |
| - Se deben mostrar como referencia las garantías que el locatario ofreció en su solicitud. |
| - Se pueden agregar hasta 3 garantes, indicando para cada uno nombre y apellido, DNI y correo electrónico. Los tres datos son obligatorios. |
| - El DNI del garante debe tener 7 u 8 dígitos numéricos. |
| - El correo del garante debe respetar el mismo formato que en US-35. |
| - No se puede cargar como garante al locador ni al locatario del contrato. |
| - No se pueden repetir DNI ni correo entre garantes. |
| - Se puede quitar un garante cargado. |
| *Paso 2 · Condiciones* |
| - Se debe indicar la fecha de inicio, que no puede ser anterior a la fecha actual. |
| - Se debe indicar la duración en meses, como número entero mayor a 0. Por defecto es 24 meses. |
| - Se debe calcular automáticamente la fecha de fin a partir de la fecha de inicio y la duración. La fecha de fin no es editable. |
| - Se debe indicar el monto inicial del alquiler, como número entero mayor a 0. Por defecto se precarga el precio publicado de la propiedad. |
| - Se puede indicar el depósito en garantía, como número entero mayor o igual a 0. Por defecto equivale a un mes de alquiler. |
| - Se debe indicar el día de vencimiento del pago, entre 1 y 28. Por defecto es el día 10. |
| - Se debe indicar el índice de ajuste: Sin ajuste, ICL, IPC o CAC. |
| - Si el índice no es "Sin ajuste", se debe indicar la periodicidad del ajuste (trimestral, semestral o anual). Si es "Sin ajuste", no se muestra el campo de periodicidad. |
| - Se debe informar la cantidad de ajustes que tendrá el contrato y la fecha del primero. |
| - Se deben mostrar en solo lectura las condiciones de cobro cargadas en la propiedad (medios de pago, días de gracia e interés por mora). |
| *Paso 3 · Cláusulas* |
| - Se debe generar el contrato a partir de la plantilla de locación de vivienda de RentAR, completada automáticamente con los datos de los pasos 1 y 2. |
| - Las cláusulas fijas (por ejemplo, Objeto y destino) no se pueden editar y se deben mostrar como bloqueadas. |
| - Las cláusulas editables se pueden modificar, con un máximo de 1.000 caracteres por cláusula. |
| - Se pueden agregar cláusulas propias, con un máximo de 1.000 caracteres cada una. |
| - Se puede eliminar una cláusula agregada por el locador. |
| - Se debe indicar la cantidad total de cláusulas y cuántas fueron editadas. |
| - Se debe poder ver el contrato completo. |
| *Paso 4 · Revisión y envío* |
| - Se debe mostrar un resumen de todo lo cargado: propiedad, partes, garantes, vigencia, monto inicial, ajuste, depósito, vencimiento del pago y cláusulas. Cada bloque tiene la opción de volver a editarlo. |
| - Para enviar a firmar, se debe marcar la casilla "Revisé las condiciones y las cláusulas, y entiendo que después de enviarlo no puedo editarlo". |
| - Se debe solicitar confirmación antes de enviar a firmar, indicando quiénes deben firmar. |
| - Al enviarlo, el contrato pasa al estado "pendiente de firma", recibe un código con formato CT-AAAA-NNNN y no se puede editar. |
| - La propiedad sigue publicada mientras el contrato esté pendiente de firma. |
| *Borrador* |
| - Se puede guardar el contrato como borrador desde cualquier paso. |
| - Un borrador se puede retomar desde el paso en que quedó. |
| - Se puede eliminar un borrador, previa confirmación. |
| *Listado de contratos (/panel/contratos)* |
| - Se debe mostrar el listado de contratos del locador, con propiedad, código, locatario, estado, monto actual, vigencia y fecha del próximo ajuste. |
| - Se pueden filtrar los contratos por estado: todos, borradores, pendientes de firma, vigentes y finalizados. Se debe mostrar la cantidad de contratos de cada estado. |
| - Se pueden buscar contratos por dirección de la propiedad o por nombre del locatario. |
| - Por defecto, el listado muestra primero los pendientes de firma y después el resto, ordenado por fecha de fin. |
| - Si el locador no tiene contratos, se debe mostrar un mensaje con acceso a las solicitudes aceptadas. |
| **Pruebas de usuario:** |
| - Probar registrar un contrato sin haber iniciado sesión (falla). |
| - Probar registrar un contrato para una propiedad de otro locador, accediendo por URL (falla). |
| - Probar iniciar un contrato desde una solicitud aceptada y verificar que la propiedad y los datos del locatario estén precargados y no se puedan editar (pasa). |
| - Probar iniciar un contrato desde una solicitud pendiente o rechazada (falla). |
| - Probar iniciar un segundo contrato desde la misma solicitud aceptada (falla). |
| - Probar registrar un contrato para una propiedad con un contrato vigente o pendiente de firma (falla). |
| - Probar registrar un contrato sin garantes (pasa). |
| - Probar agregar 3 garantes con datos válidos (pasa). |
| - Probar agregar un cuarto garante (falla). |
| - Probar agregar un garante sin nombre, DNI o correo (falla). |
| - Probar agregar un garante con un DNI de menos de 7 o más de 8 dígitos, o con caracteres no numéricos (falla). |
| - Probar agregar como garante al locatario o al locador del contrato (falla). |
| - Probar agregar dos garantes con el mismo DNI o el mismo correo (falla). |
| - Probar indicar una fecha de inicio anterior a la fecha actual (falla). |
| - Probar indicar una duración de 0 meses o con decimales (falla). |
| - Probar modificar la duración y verificar que la fecha de fin se recalcule (pasa). |
| - Probar verificar que el monto inicial venga precargado con el precio publicado y que se pueda modificar (pasa). |
| - Probar indicar un monto inicial igual a 0, negativo o con decimales (falla). |
| - Probar indicar un depósito negativo (falla). |
| - Probar indicar un día de vencimiento fuera del rango de 1 a 28 (falla). |
| - Probar elegir "Sin ajuste" y verificar que no se muestre la periodicidad (pasa). |
| - Probar elegir ICL con ajuste semestral para 36 meses y verificar que se informen 5 ajustes y la fecha del primero (pasa). |
| - Probar elegir un índice distinto de "Sin ajuste" sin indicar la periodicidad (falla). |
| - Probar intentar editar una cláusula fija (falla). |
| - Probar editar una cláusula editable con hasta 1.000 caracteres (pasa). |
| - Probar editar una cláusula con más de 1.000 caracteres (falla). |
| - Probar agregar y luego eliminar una cláusula propia (pasa). |
| - Probar enviar a firmar sin marcar la casilla de revisión (falla). |
| - Probar enviar a firmar, cancelar la confirmación y verificar que el contrato siga editable (pasa). |
| - Probar enviar a firmar y verificar que el contrato quede pendiente de firma, con código CT-AAAA-NNNN, y que no se pueda editar (pasa). |
| - Probar guardar un borrador en el paso 2, salir y retomarlo desde ese paso con los datos cargados (pasa). |
| - Probar eliminar un borrador confirmando la acción (pasa). |
| - Probar filtrar el listado de contratos por cada estado y verificar los resultados y las cantidades (pasa). |
| - Probar buscar un contrato por el nombre del locatario (pasa). |
