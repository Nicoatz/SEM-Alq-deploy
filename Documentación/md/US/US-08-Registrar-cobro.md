| **Registrar cobro** |
| - |
| Como locador, quiero registrar un cobro recibido por fuera de la plataforma (por ejemplo, transferencia o efectivo) para llevar el registro de los pagos del locatario. |
| **Criterios de aceptación:** |
| *Acceso* |
| - Se debe haber iniciado sesión con el usuario locador dueño de la propiedad. |
| - Se debe registrar desde Cobros (/panel/cobros), con el botón general "Registrar cobro", o desde el detalle de un período (/panel/cobros/[id]), con "Registrar un pago a mano". |
| - Solo se pueden registrar cobros de contratos vigentes. |
| - El locatario no puede registrar cobros. |
| *Períodos* |
| - Solo se pueden registrar cobros de períodos en estado "pendiente" o "vencido", incluidos los de meses anteriores. |
| - No se pueden registrar cobros de períodos futuros ni de períodos pagados. |
| *Formulario (modal sobre el listado)* |
| - Si se entra desde el detalle de un período, la propiedad, el locatario y el período vienen elegidos. Si se entra desde el botón general, hay que elegir la propiedad (solo las que tienen contrato vigente) y el período. |
| - Se debe registrar el saldo del período: el alquiler más los intereses por mora a la fecha del cobro (US-12). No se aceptan cobros parciales. |
| - Se debe indicar la fecha del cobro, que no puede ser futura ni anterior a la fecha de inicio del contrato. Por defecto es la fecha actual. |
| - Se debe indicar el medio: transferencia, efectivo, cheque, MercadoPago (fuera de RentAR) u otro. Si es "otro", se debe indicar una nota de hasta 200 caracteres. |
| - Se puede adjuntar un comprobante del pago, en PDF, JPG o PNG, de hasta 8 MB. |
| *Al registrar* |
| - El medio se registra tal cual se cargó: un cobro registrado a mano nunca se muestra como pagado a través de RentAR. |
| - Se debe registrar quién cargó el cobro, con fecha y hora, en el historial del período y del contrato. |
| **Pruebas de usuario:** |
| - Probar registrar un cobro sin haber iniciado sesión (falla). |
| - Probar registrar un cobro habiendo iniciado sesión como locatario (falla). |
| - Probar registrar un cobro de una propiedad de otro locador, accediendo por URL (falla). |
| - Probar registrar un cobro de un contrato pendiente de firma o finalizado (falla). |
| - Probar registrar un cobro desde el detalle de un período y verificar que la propiedad, el locatario y el período vengan elegidos (pasa). |
| - Probar registrar un cobro desde el botón general y verificar que solo se ofrezcan propiedades con contrato vigente (pasa). |
| - Probar registrar un cobro de un período futuro o ya pagado (falla). |
| - Probar verificar que el monto venga precargado con el saldo del período (pasa). |
| - Probar verificar que el saldo precargado de un período vencido incluya los intereses por mora (pasa). |
| - Probar registrar el saldo completo y verificar que el período pase a "pagado" (pasa). |
| - Probar registrar una fecha futura o anterior al inicio del contrato (falla). |
| - Probar elegir el medio "otro" sin nota (falla). |
| - Probar adjuntar un comprobante de más de 8 MB o en un formato no admitido (falla). |
| - Probar registrar un cobro sin adjuntar comprobante (pasa). |
| - Probar registrar un cobro en efectivo y verificar que el medio figure como "Efectivo" en el detalle y en el comprobante (pasa). |
| - Probar verificar que el cobro figure en el historial con quién lo cargó, la fecha y la hora (pasa). |
