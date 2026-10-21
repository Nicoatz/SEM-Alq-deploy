| **Modificar usuario** |
| - |
| Como usuario, quiero modificar mis datos para mantener mi información actualizada. |
| **Criterios de aceptación:** |
| *General* |
| - Se debe haber iniciado sesión. Solo se pueden modificar los datos propios. |
| - Cada bloque (Datos personales, Legajo y Contraseña) se modifica y se guarda por separado, con sus propios botones de guardar y cancelar. |
| - Cancelar restaura los valores guardados del bloque. |
| - Se debe avisar si el usuario intenta salir de la pantalla con cambios sin guardar. |
| - Al guardar, se debe mostrar un mensaje de éxito o el error correspondiente, en español. |
| - Modificar el perfil no modifica las solicitudes ya enviadas ni los contratos existentes. |
| *Datos personales* |
| - Se pueden modificar el nombre y el apellido: son obligatorios, de 2 a 100 caracteres, y solo admiten letras, espacios, apóstrofos y guiones. |
| - Se puede modificar el DNI: 7 u 8 dígitos numéricos, único en la plataforma. |
| - El nombre, el apellido y el DNI no se pueden modificar si el usuario es parte de un contrato vigente o pendiente de firma. En ese caso se debe explicar el motivo. |
| - Se puede modificar el teléfono, con las mismas reglas que en US-35: UIT-T E.164 de 10 a 15 dígitos, solo caracteres numéricos, prefijo "+" visible y no editable, y formato visual E.123. |
| - Se puede modificar la fecha de nacimiento: el usuario debe ser mayor de 18 años. |
| - Se puede modificar el correo electrónico con el mismo formato que en US-35 y debe ser único en la plataforma. El cambio solo se aplica cuando el usuario confirma el nuevo correo desde el enlace que se le envía; hasta entonces sigue vigente el anterior. |
| *Legajo* |
| - Se puede modificar la situación ocupacional, con las mismas opciones que en US-35 ("-", relación de dependencia, monotributista, autónoma, estudiante y jubilada). |
| - Se puede modificar el ingreso mensual declarado: un número entero mayor a 0, o vacío. |
| - Se pueden indicar múltiples garantías que el usuario puede ofrecer (garantía propietaria, seguro de caución u otra). |
| - Los datos del legajo se precargan en las solicitudes nuevas (US-35). Los cambios que se hagan dentro de una solicitud no modifican el perfil. |
| *Contraseña* |
| - Para cambiar la contraseña se deben ingresar la contraseña actual, la nueva y su confirmación. |
| - La contraseña nueva debe cumplir las mismas reglas que en el registro (US-19) y ser distinta de la actual. |
| - Se debe mostrar el indicador de seguridad de la contraseña nueva. |
| **Pruebas de usuario:** |
| - Probar modificar los datos sin haber iniciado sesión (falla). |
| - Probar modificar el nombre y el apellido con valores válidos y verificar que se reflejen en el perfil y en el menú de usuario (pasa). |
| - Probar dejar el nombre vacío o ingresar números o símbolos no admitidos (falla). |
| - Probar modificar el DNI por uno ya registrado por otro usuario (falla). |
| - Probar modificar el DNI con menos de 7 o más de 8 dígitos (falla). |
| - Probar modificar el nombre o el DNI siendo parte de un contrato vigente (falla). |
| - Probar modificar el teléfono con un número válido de entre 10 y 15 dígitos (pasa). |
| - Probar modificar el teléfono con letras, o con menos de 10 o más de 15 dígitos (falla). |
| - Probar modificar la fecha de nacimiento de forma que el usuario quede menor de 18 años (falla). |
| - Probar modificar el correo y verificar que no cambie hasta confirmarlo desde el enlace (pasa). |
| - Probar modificar el correo por uno ya registrado o con un formato inválido (falla). |
| - Probar modificar la situación ocupacional, los ingresos y las garantías del legajo y verificar que se precarguen en una solicitud nueva (pasa). |
| - Probar ingresar un ingreso mensual igual a 0, negativo o con decimales (falla). |
| - Probar modificar el legajo dentro de una solicitud y verificar que el perfil no cambie (pasa). |
| - Probar cambiar la contraseña ingresando mal la contraseña actual (falla). |
| - Probar cambiar la contraseña con una nueva que no cumple las reglas de US-19, o cuya confirmación no coincide (falla). |
| - Probar cambiar la contraseña con datos válidos e iniciar sesión con la nueva (pasa). |
| - Probar cancelar la edición de un bloque y verificar que se restauren los valores guardados (pasa). |
| - Probar salir de la pantalla con cambios sin guardar y verificar que se muestre el aviso (pasa). |
| - Probar modificar el teléfono del perfil y verificar que no cambie en una solicitud ya enviada (pasa). |
