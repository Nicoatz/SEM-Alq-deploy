| **Registrar contrato de alquiler** |
| - |
| Como locador, quiero registrar un contrato de alquiler a partir de una solicitud aceptada, indicando sus condiciones, índice de ajuste y garantes, y cargando el contrato en PDF, para formalizar el alquiler con el locatario. |
| **Criterios de aceptación:** |
| *Acceso e inicio* |
| - Se debe haber iniciado sesión con el usuario locador dueño de la propiedad. |
| - Se debe iniciar el contrato desde una solicitud aceptada (botón "Iniciar contrato"), con la propiedad y el locatario precargados. |
| - La propiedad no debe tener un contrato vigente ni pendiente de firma. |
| - Una solicitud aceptada puede originar un solo contrato. |
| - El alta se realiza en 4 pasos (Partes y garantes, Condiciones, Carga y Revisión). Se debe mostrar el paso actual y se puede volver a los pasos anteriores sin perder lo cargado. |
| - Si el usuario intenta salir del alta con cambios sin guardar, se debe mostrar un aviso. |
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
| - Se debe calcular automáticamente la fecha de fin a partir de la fecha de inicio y la duración. Si ese día no existe en el mes de fin, se toma el último día del mes. La fecha de fin no es editable. |
| - Se debe indicar el monto inicial del alquiler, como número entero mayor a 0. Por defecto se precarga el precio publicado de la propiedad. |
| - Se puede indicar el depósito en garantía, como número entero mayor o igual a 0. Por defecto equivale a un mes de alquiler. |
| - Se debe indicar el plazo de vencimiento del pago, en días, entre 1 y 28. Por defecto es de 10 días. |
| - Se debe indicar el índice de ajuste: Sin ajuste, ICL, IPC o CAC. |
| - Si el índice no es "Sin ajuste", se debe indicar la periodicidad del ajuste (trimestral, semestral o anual). Si es "Sin ajuste", no se muestra el campo de periodicidad. |
| - Se debe informar la cantidad de ajustes que tendrá el contrato y la fecha del primero. |
| - Se deben mostrar en solo lectura las condiciones de cobro cargadas en la propiedad (medios de pago, días de gracia e interés por mora). |
| *Paso 3 · Carga* |
| - Se debe cargar el contrato en formato PDF, con un tamaño no superior a 5MB. |
| - Si el archivo no es un PDF o supera los 5MB, se debe rechazar e informar el motivo, sin reemplazar el PDF que ya estaba cargado. |
| - Se debe mostrar el nombre y el tamaño del archivo cargado, y se puede reemplazar por otro PDF mientras el contrato esté en borrador. |
| *Paso 4 · Revisión y envío* |
| - Se debe mostrar un resumen de todo lo cargado: propiedad, partes, garantes, vigencia, monto inicial, ajuste, depósito, vencimiento del pago y una miniatura de la primera página del PDF. Cada bloque tiene la opción de volver a editarlo. |
| - Para enviar a firmar, se debe haber cargado el PDF del contrato. |
| - Para enviar a firmar, se debe marcar la casilla "Revisé la correcta redacción del contrato y entiendo que después de enviarlo no puedo editarlo". |
| - Se debe solicitar confirmación antes de enviar a firmar, indicando quiénes deben firmar. |
| - Al enviarlo, el contrato pasa al estado "pendiente de firma" y recibe un código con formato CT-AAAA-NNNN. |
| - La propiedad sigue publicada mientras el contrato esté pendiente de firma. |
| *Borrador* |
| - Se puede guardar el contrato como borrador desde cualquier paso, sin completar los datos obligatorios de los pasos siguientes. |
| - El borrador queda en estado "borrador" y recuerda el último paso en que estaba el usuario. |
| **Pruebas de usuario:** |
| - Probar registrar un contrato sin haber iniciado sesión (falla). |
| - Probar registrar un contrato para una propiedad de otro locador, accediendo por URL (falla). |
| - Probar iniciar un contrato desde una solicitud aceptada y verificar que la propiedad y los datos del locatario estén precargados y no se puedan editar (pasa). |
| - Probar iniciar un contrato desde una solicitud pendiente o rechazada (falla). |
| - Probar iniciar un segundo contrato desde la misma solicitud aceptada (falla). |
| - Probar registrar un contrato para una propiedad con un contrato vigente o pendiente de firma (falla). |
| - Probar salir del alta con cambios sin guardar y verificar que se muestre el aviso (pasa). |
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
| - Probar una fecha de inicio 31/01 con 1 mes de duración y verificar que la fecha de fin sea el último día de febrero (pasa). |
| - Probar verificar que el monto inicial venga precargado con el precio publicado y que se pueda modificar (pasa). |
| - Probar indicar un monto inicial igual a 0, negativo o con decimales (falla). |
| - Probar indicar un depósito negativo (falla). |
| - Probar indicar un plazo de vencimiento fuera del rango de 1 a 28 días (falla). |
| - Probar elegir "Sin ajuste" y verificar que no se muestre la periodicidad (pasa). |
| - Probar elegir ICL con ajuste semestral para 36 meses y verificar que se informen 5 ajustes y la fecha del primero (pasa). |
| - Probar elegir un índice distinto de "Sin ajuste" sin indicar la periodicidad (falla). |
| - Probar cargar un contrato en PDF de hasta 5MB y verificar que se muestren su nombre y su tamaño (pasa). |
| - Probar cargar un archivo de más de 5MB (falla). |
| - Probar cargar un archivo que no sea PDF, por ejemplo un documento de Word o una imagen (falla). |
| - Probar cargar un archivo de otro formato con la extensión cambiada a .pdf (falla). |
| - Probar cargar un segundo PDF y verificar que reemplace al anterior (pasa). |
| - Probar cargar un archivo inválido teniendo ya un PDF cargado y verificar que se conserve el anterior (pasa). |
| - Probar llegar al paso 4 y verificar que se muestre la miniatura de la primera página del PDF (pasa). |
| - Probar enviar a firmar sin haber cargado el PDF (falla). |
| - Probar enviar a firmar sin marcar la casilla de revisión (falla). |
| - Probar enviar a firmar, cancelar la confirmación y verificar que el contrato no se envíe (pasa). |
| - Probar enviar a firmar y verificar que el contrato quede pendiente de firma, con código CT-AAAA-NNNN (pasa). |
| - Probar guardar un borrador en el paso 2 sin completar los pasos 3 y 4 y verificar que quede en estado "borrador" (pasa). |
