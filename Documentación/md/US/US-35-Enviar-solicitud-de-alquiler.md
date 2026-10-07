| **Enviar solicitud de alquiler** |
| - |
| Como locatario quiero enviar una solicitud de alquiler a una propiedad para informar al locatario mi interés en la misma. |
| **Criterios de aceptación:** |
| - Se debe haber iniciado sesión y el usuario no debe ser propietario de la propiedad a realizar la solicitud. |
| - Se puede adjuntar un mensaje de hasta 600 caracteres. |
| - Se debe informar en tiempo real la cantidad de caracteres ingresados en el mensaje. |
| - Se deben mostrar los datos del locatario (nombre, apellido, dni, teléfono y dirección de correo). |
| - Se puede modificar el teléfono e email a incluir en la solicitud, pero no el nombre, apellido ni dni. |
| - Se puede indicar la situación ocupacional del locatario (-, relación de dependencia, monotributista, autónoma, estudiante, jubilada). |
| - Se puede indicar el monto de ingresos aproximados del locatario, siendo este un número entero superior a 0. |
| - Se puede indicar la cantidad de personas a residir en la propiedad a alquilar, siendo una (1) la cantidad mínima. |
| - Se puede indicar si el locatario posee mascotas o no. |
| - Se debe indicar por defecto que el locatario no posee mascotas. |
| - Por defecto el monto de ingresos aproximados debe ser cero (0). |
| - Por defecto la cantidad de personas a residir en la propiedad debe ser una (1). |
| - Por defecto la relación de dependencia debe ser "-" (que indica "prefiero no decirlo"). |
| - Se puede adjuntar un mensaje detallando información de las mascotas en caso de haber indicado que sí posee mascotas. |
| - Se pueden indicar múltiples garantías a ofrecer (garantía propietaria, seguro de caución, otra). |
| - Se deben marcar las garantías solicitadas explícitamente por el locador para la propiedad, si las hubiera. | 
| - Se debe aceptar lo que implica el envío de la solicitud. |
| - Se debe indicar cuántas solicitudes pendientes tiene el locatario en otras propiedades, si es que la cantidad es superior a cero (0). |
| - Se debe dar formato visual de manera automática al número de teléfono ingresado, respetando la recomendación UIT-T E.123: signo "+" para indicar prefijo internacional, espacios para mejorar la legibilidad (ejemplo +34 91 123 4567). |
| - Se debe ingresar el número de teléfono respetando la recomendación UIT-T E.164: longitud mínima de 10 dígitos y máxima de 15 dígitos, formato "[+][código de país][número nacional]", sin espacios, guiones u otros separadores en su representación canónica. |
| - Se deben ingresar únicamente caracteres numéricos en el campo de número de teléfono. |
| - Se debe mostrar el prefijo internacional ("+"), pero no ser editable. |
| - Se debe ingresar el correo electrónico en formato general "nombre@dominio.extension", admitiendo variaciones comunes tales como "nombre.apellido@dominio.extension", "nombre+var@dominio.extension.extension2", "nombre_apellido@dominio.extension", etc. |
| - Se deben mostrar los datos de la propiedad a la que se enviará la solicitud (dirección, piso, barrio, cantidad de ambientes, metros cuadrados (reales), aceptación de mascotas, monto mensual y foto principal). | 
| **Pruebas de usuario:** |
| - Probar enviar una solicitud de alquiler sin haber iniciado sesión (falla). |
| - Probar enviar una solicitud de alquiler sin adjuntar un mensaje (pasa). |
| - Probar enviar una solicitud de alquiler adjuntando un mensaje con más de 600 caracteres (falla). |
| - Probar enviar una solicitud de alquiler para una propiedad propia (falla). |
| - Probar enviar una solicitud de alquiler con un mensaje de exactamente 600 caracteres (pasa). |
| - Probar enviar una solicitud de alquiler y verificar que el contador del mensaje se actualice al escribir y borrar texto (pasa). |
| - Probar enviar una solicitud de alquiler y verificar que se muestren nombre, apellido, DNI, teléfono y correo electrónico del usuario (pasa). |
| - Probar enviar una solicitud de alquiler e intentar modificar el nombre, apellido o DNI del usuario (falla). |
| - Probar enviar una solicitud de alquiler después de modificar el teléfono y el correo electrónico (pasa). |
| - Probar enviar una solicitud de alquiler seleccionando cada situación ocupacional disponible (pasa). |
| - Probar enviar una solicitud de alquiler indicando el monto aproximado de ingresos del locatario superior a 0 (pasa). |
| - Probar enviar una solicitud de alquiler indicando el monto aproximado de ingresos del locatario con un monto negativo (falla). |
| - Probar enviar una solicitud de alquiler indicando el monto aproximado de ingresos del locatario con un monto con números decimales (falla). |
| - Probar enviar una solicitud de alquiler indicando menos de una persona a residir en la propiedad (falla). |
| - Probar enviar una solicitud de alquiler indicando una o más personas a residir en la propiedad (pasa). |
| - Probar enviar una solicitud de alquiler y verificar que la opción predeterminada para las mascotas sea "No" (pasa). |
| - Probar enviar una solicitud de alquiler indicando que no se poseen mascotas y verificar que no aparezca el campo para detallar información sobre ellas (pasa). |
| - Probar enviar una solicitud de alquiler indicando que se poseen mascotas y se hace visible el campo para ingresar información adicional (pasa). |
| - Probar enviar una solicitud de alquiler indicando que se poseen mascotas e ingresando información sobre ellas (pasa). |
| - Probar enviar una solicitud de alquiler seleccionando más de un tipo de garantía (pasa). |
| - Probar enviar una solicitud de alquiler sin indicar garantías para una propiedad que no las exige (pasa). |
| - Probar enviar una solicitud de alquiler sin indicar las garantías exigidas por el locador para la propiedad (falla). |
| - Probar enviar una solicitud de alquiler sin aceptar lo que implica su envío (falla). |
| - Probar enviar una solicitud de alquiler después de aceptar lo que implica su envío (pasa). |
| - Probar enviar una solicitud de alquiler y verificar que se informe la cantidad de solicitudes pendientes del usuario (pasa). |
| - Probar enviar una solicitud de alquiler y verificar que por defecto la situación ocupacional sea "-" (pasa). |
| - Probar enviar una solicitud de alquiler y verificar que por defecto los ingresos aproximados sean "0" (pasa). |
| - Probar enviar una solicitud de alquiler cuando el usuario no tiene solicitudes pendientes y verificar que no aparezca un aviso innecesario (pasa). |
| - Probar enviar una solicitud de alquiler con un teléfono válido de hasta 15 dígitos, incluyendo el código de país (pasa). |
| - Probar enviar una solicitud de alquiler ingresando letras, espacios, guiones u otros caracteres no numéricos en el teléfono (falla). |
| - Probar enviar una solicitud de alquiler con un teléfono de más de 15 dígitos (falla). |
| - Probar enviar una solicitud de alquiler con un teléfono de menos de 10 dígitos (falla). |
| - Probar enviar una solicitud de alquiler con un teléfono válido y verificar que se muestre con «+» y espacios, sin alterar su representación canónica E.164 (pasa). |
| - Probar enviar una solicitud de alquiler con un correo válido en los formatos admitidos, incluidos puntos, «+» y guiones bajos en el nombre (pasa). |
| - Probar enviar una solicitud de alquiler con un correo electrónico de formato inválido (falla). |
| - Probar enviar una solicitud de alquiler y verificar que se muestren los datos de la propiedad seleccionada: dirección, piso, barrio, ambientes, metros cuadrados reales, aceptación de mascotas, monto mensual y foto principal (pasa). |
| - Probar enviar una solicitud de alquiler y verificar que quede asociada a la propiedad seleccionada e incluya los datos y opciones ingresados (pasa). |
