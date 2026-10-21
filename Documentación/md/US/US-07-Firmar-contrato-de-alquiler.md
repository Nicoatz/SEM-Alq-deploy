| **Firmar contrato de alquiler** |
| - |
| Como locador o locatario, quiero firmar electrónicamente el contrato de alquiler para formalizar el acuerdo entre las partes. |
| **Criterios de aceptación:** |
| *Acceso* |
| - Se debe haber iniciado sesión con un usuario que sea locador o locatario del contrato. |
| - Solo se pueden firmar contratos en estado "pendiente de firma". |
| - El locador firma desde el detalle del contrato (/panel/contratos/[id]) y el locatario, desde Mi alquiler (/panel/alquiler). |
| - Si el contrato no existe o no es del usuario, se debe mostrar "No encontramos este contrato", sin distinguir entre los dos casos. |
| *Detalle del contrato* |
| - Se debe mostrar el estado de cada firmante: pendiente, firmado (con fecha y hora) o rechazado (con el motivo). |
| - Se debe indicar cuántas firmas faltan. |
| - Se deben mostrar los datos principales del contrato: propiedad, partes, garantes, vigencia, monto inicial, depósito, ajuste y día de vencimiento del pago. |
| - Se debe mostrar el documento del contrato y permitir descargarlo en PDF en cualquier estado. |
| - Se debe mostrar el historial del contrato: creación, envío a firmar, firmas, rechazos, reenvíos y cancelaciones, con fecha y hora. |
| *Firma* |
| - Antes de firmar, se debe informar que en esta versión de la plataforma la firma es simulada. |
| - El botón "Firmar contrato" solo se habilita cuando el usuario llegó a la última página del documento y marcó la casilla "Leí el contrato completo y acepto sus condiciones y cláusulas". |
| - Mientras el botón no esté habilitado, se debe indicar cuántas páginas faltan leer. |
| - Volver a páginas anteriores no reduce el progreso de lectura. |
| - Se debe solicitar confirmación antes de firmar, avisando que la firma no se puede deshacer. |
| - Se deben registrar la fecha, la hora y la IP de cada firma. |
| - Una parte no puede firmar más de una vez el mismo contrato. |
| *Rechazo y cancelación* |
| - El locatario puede rechazar la firma, indicando un motivo opcional de hasta 300 caracteres, previa confirmación. Esto no cambia el estado del contrato, que sigue pendiente de firma, y el rechazo se ve en el detalle. |
| - El locador puede cancelar el envío mientras ninguna otra parte haya firmado. El contrato vuelve a "borrador" y se borran las firmas registradas. |
| - El locador puede reenviar la invitación a un firmante pendiente, como máximo una vez por hora. Mientras no pueda reenviar, el botón debe explicar por qué. |
| *Contrato vigente* |
| - Cuando firman todas las partes, el contrato pasa a "vigente". |
| - Cuando el contrato pasa a vigente, la propiedad pasa a "alquilada" y deja de aparecer en la búsqueda de propiedades. |
| - Cuando el contrato pasa a vigente, las solicitudes pendientes de esa propiedad pasan a "rechazadas", con un mensaje automático de que la propiedad ya fue alquilada. |
| - Con el contrato vigente, el detalle muestra "Firmado por todas las partes el dd/mm/aaaa" y desaparecen las acciones de firma, reenvío y cancelación. |
| **Pruebas de usuario:** |
| - Probar firmar un contrato sin haber iniciado sesión (falla). |
| - Probar acceder por URL al contrato de otro usuario (falla). |
| - Probar firmar un contrato en estado borrador o vigente (falla). |
| - Probar verificar que se muestre el aviso de firma simulada antes de firmar (pasa). |
| - Probar firmar sin haber llegado a la última página del documento (falla). |
| - Probar firmar habiendo llegado a la última página sin marcar la casilla de aceptación (falla). |
| - Probar volver a una página anterior y verificar que el progreso de lectura no baje (pasa). |
| - Probar firmar como locador cumpliendo las dos condiciones y confirmando (pasa). |
| - Probar firmar, cancelar la confirmación y verificar que no se haya registrado la firma (pasa). |
| - Probar firmar dos veces con el mismo usuario (falla). |
| - Probar verificar que en el detalle se muestren la fecha y la hora de cada firma registrada (pasa). |
| - Probar rechazar la firma como locatario con un motivo de hasta 300 caracteres (pasa). |
| - Probar rechazar la firma con un motivo de más de 300 caracteres (falla). |
| - Probar cancelar el envío como locador cuando nadie más firmó y verificar que el contrato vuelva a borrador (pasa). |
| - Probar cancelar el envío como locador cuando el locatario ya firmó (falla). |
| - Probar cancelar el envío habiendo iniciado sesión como locatario (falla). |
| - Probar reenviar una invitación dos veces dentro de la misma hora (falla). |
| - Probar completar todas las firmas y verificar que el contrato quede vigente y la propiedad, alquilada (pasa). |
| - Probar completar todas las firmas y verificar que la propiedad no aparezca en la búsqueda (pasa). |
| - Probar completar todas las firmas y verificar que las solicitudes pendientes de la propiedad pasen a rechazadas con el mensaje automático (pasa). |
| - Probar descargar el PDF del contrato pendiente de firma y del vigente (pasa). |
