| **Firmar contrato de alquiler** |
| - |
| Como locador, locatario o garante, quiero firmar electrónicamente el contrato de alquiler para formalizar el acuerdo entre las partes. |
| **Criterios de aceptación:** |
| *Acceso* |
| - Se debe haber iniciado sesión con un usuario que sea locador o locatario del contrato. Los garantes firman sin sesión, desde su enlace (ver "Garantes"). |
| - Solo se pueden firmar contratos en estado "pendiente de firma". |
| - El locador firma desde el detalle del contrato (/panel/contratos/[id]) y el locatario, desde Mi alquiler (/panel/alquiler). |
| - Si el contrato no existe o no es del usuario, se debe mostrar "No encontramos este contrato", sin distinguir entre los dos casos. |
| *Detalle del contrato* |
| - Se debe mostrar el estado de cada firmante (locador, locatario y garantes): pendiente o firmado (con fecha y hora). |
| - Se debe indicar cuántas firmas faltan. |
| - Se deben mostrar los datos principales del contrato: propiedad, partes, garantes, vigencia, monto inicial, depósito, ajuste y día de vencimiento del pago. |
| - Se debe mostrar el documento del contrato y permitir descargarlo en PDF en cualquier estado. |
| *Firma* |
| - Antes de firmar se debe informar que, mientras se use el entorno de prueba de DocuSign, la firma no tiene validez legal. |
| - El botón "Firmar contrato" solo se habilita cuando el usuario llegó a la última página del documento y marcó la casilla "Leí el contrato completo y acepto sus condiciones y cláusulas". |
| - Mientras el botón no esté habilitado, se debe indicar cuántas páginas faltan leer. |
| - Volver a páginas anteriores no reduce el progreso de lectura. |
| - Se debe solicitar confirmación antes de firmar, avisando que la firma no se puede deshacer. |
| - Al confirmar, el usuario firma en DocuSign y vuelve a RentAR. Mientras se registra la firma, se debe mostrar "Estamos registrando tu firma"; si tarda más de 45 segundos, "Todavía estamos registrando tu firma" con la opción de actualizar. |
| - Se deben registrar la fecha y la hora de cada firma. |
| - Una parte no puede firmar más de una vez el mismo contrato. |
| *Garantes* |
| - Los garantes firman el contrato desde un enlace temporal que les entrega el locador, sin necesidad de iniciar sesión. |
| - El enlace vence a los 2 días y deja de funcionar cuando el garante firma o cuando el contrato vuelve a borrador. Si el locador genera un enlace nuevo, el anterior deja de funcionar. |
| - Si el enlace no existe, venció o ya se usó, se debe mostrar el mismo mensaje en los tres casos. |
| - El enlace se muestra una sola vez, cuando el locador lo genera, con su fecha y hora de vencimiento. |
| - El garante ve su nombre, el código del contrato y la propiedad, y lee el contrato en DocuSign antes de firmar. |
| - Para firmar, el garante debe marcar la casilla "Leí el contrato completo y acepto sus condiciones y cláusulas" y confirmar. No se le pide llegar a la última página: el contrato completo se lee en DocuSign. |
| - Los garantes solo pueden firmar: no pueden rechazar la firma. |
| - En el detalle del contrato se debe mostrar el estado de la firma de cada garante, igual que el de las partes. |
| *Rechazo y cancelación* |
| - Tanto el locatario como el locador pueden rechazar la firma mientras no hayan firmado. |
| - Al rechazar, el contrato vuelve a "borrador", se borran todas las firmas registradas y dejan de funcionar los enlaces de los garantes. Para volver a firmar, el locador debe enviarlo de nuevo y firman todos otra vez. |
| - Después de un rechazo, el locatario ya no ve el contrato hasta que el locador lo vuelva a enviar. |
| *Contrato vigente* |
| - Cuando firman el locador, el locatario y todos los garantes, el contrato pasa a "vigente". |
| - Cuando el contrato pasa a vigente, la propiedad pasa a "alquilada" y deja de aparecer en la búsqueda de propiedades. |
| - Cuando el contrato pasa a vigente, las solicitudes pendientes de esa propiedad pasan a "rechazadas", con un mensaje automático de que la propiedad ya fue alquilada. |
| - Con el contrato vigente, el detalle muestra "Firmado por todas las partes el dd/mm/aaaa" y desaparecen las acciones de firma y cancelación. |
| **Pruebas de usuario:** |
| - Probar firmar un contrato sin haber iniciado sesión (falla). |
| - Probar acceder por URL al contrato de otro usuario (falla). |
| - Probar firmar un contrato en estado borrador o vigente (falla). |
| - Probar verificar que se muestre el aviso de firma de prueba antes de firmar (pasa). |
| - Probar firmar sin haber llegado a la última página del documento (falla). |
| - Probar firmar habiendo llegado a la última página sin marcar la casilla de aceptación (falla). |
| - Probar volver a una página anterior y verificar que el progreso de lectura no baje (pasa). |
| - Probar firmar como locador cumpliendo las dos condiciones y confirmando (pasa). |
| - Probar firmar, cancelar la confirmación y verificar que no se haya registrado la firma (pasa). |
| - Probar firmar dos veces con el mismo usuario (falla). |
| - Probar verificar que en el detalle se muestren la fecha y la hora de cada firma registrada (pasa). |
| - Probar rechazar la firma como locatario con un motivo de hasta 300 caracteres (pasa). |
| - Probar rechazar la firma con un motivo de más de 300 caracteres (falla). |
| - Probar rechazar la firma y verificar que el contrato vuelva a borrador y se borren las firmas (pasa). |
| - Probar rechazar la firma después de haber firmado (falla). |
| - Probar volver de DocuSign sin firmar y verificar que la firma siga pendiente (pasa). |
| - Probar abrir la URL de regreso con "event=signing_complete" sin haber firmado y verificar que no se muestre como firmado (pasa). |
| - Probar firmar como garante con un enlace válido, sin iniciar sesión (pasa). |
| - Probar abrir el enlace de un garante vencido, ya usado o inexistente y verificar que el mensaje sea el mismo (pasa). |
| - Probar firmar como garante con un enlace que quedó sin efecto porque el locador generó uno nuevo (falla). |
| - Probar firmar como garante sin marcar la casilla de aceptación (falla). |
| - Probar volver de DocuSign como garante después de firmar y verificar que se muestre que la firma quedó registrada (pasa). |
| - Probar generar un enlace nuevo para un garante y verificar que se pida confirmación avisando que el anterior deja de funcionar (pasa). |
| - Probar rechazar la firma como garante (falla). |
| - Probar que con el locador y el locatario firmados y un garante pendiente el contrato siga pendiente de firma (pasa). |
| - Probar completar todas las firmas y verificar que el contrato quede vigente y la propiedad, alquilada (pasa). |
| - Probar completar todas las firmas y verificar que la propiedad no aparezca en la búsqueda (pasa). |
| - Probar completar todas las firmas y verificar que las solicitudes pendientes de la propiedad pasen a rechazadas con el mensaje automático (pasa). |
| - Probar descargar el PDF del contrato pendiente de firma y del vigente (pasa). |
