| **Emitir comprobante de pago** |
| - |
| Como locador, quiero emitir un comprobante de pago para dejar constancia del pago realizado por el locatario. |
| **Criterios de aceptación:** |
| *Emisión* |
| - El comprobante se emite automáticamente al registrar un cobro (US-08). No se emite a mano ni existe para un período sin cobros. |
| - Cada comprobante tiene un número con formato RC-AAAA-NNNN, correlativo por año, sin huecos y sin reutilizar números. |
| - Un comprobante emitido no se puede modificar. |
| *Acceso* |
| - Se debe haber iniciado sesión con el locador o el locatario del contrato. |
| - Se accede desde el detalle del período (/panel/cobros/[id]) y desde Mis pagos, en /panel/cobros/[id]/comprobante. |
| - Si el usuario intenta acceder por URL a un comprobante que no es suyo, se debe mostrar "No encontramos este comprobante", sin distinguir si existe. |
| - El locador y el locatario ven el mismo comprobante. |
| *Contenido* |
| - Encabezado: logo y datos de RentAR, número de comprobante, fecha y hora de emisión y estado (pagado). |
| - Locatario: nombre y apellido, DNI, correo y teléfono. |
| - Locador: nombre y apellido, DNI o CUIT, correo y teléfono. |
| - Propiedad y período: domicilio completo de la propiedad, código y vigencia del contrato, y período imputado con su rango de fechas y su fecha de vencimiento. |
| - Detalle línea por línea: alquiler del período e intereses por mora, con el total pagado en números y en letras. |
| - Medio de pago y fecha del pago. El período imputado y la fecha de pago se muestran como dos datos distintos. |
| - Se debe incluir la leyenda de que el comprobante es emitido por la plataforma y no es válido como factura. |
| *Acciones* |
| - Se puede imprimir el comprobante. Se imprime solo la hoja, sin el menú, los filtros ni los botones, en una hoja A4. |
| - Se puede descargar en PDF, con el mismo diseño que la versión impresa. El archivo se llama con el número del comprobante. |
| - En móvil, el comprobante se muestra como una tarjeta con los datos principales y la opción de descargar el PDF. |
| **Pruebas de usuario:** |
| - Probar consultar un comprobante sin haber iniciado sesión (falla). |
| - Probar registrar un cobro y verificar que se emita su comprobante con número RC-AAAA-NNNN (pasa). |
| - Probar registrar dos cobros seguidos y verificar que los números sean correlativos (pasa). |
| - Probar consultar el comprobante como locador y como locatario del contrato y verificar que sea el mismo (pasa). |
| - Probar acceder por URL al comprobante de otro contrato y verificar que se muestre "No encontramos este comprobante" (pasa). |
| - Probar verificar que el comprobante muestre los datos de las dos partes, la propiedad, el contrato, el período, el detalle, el total en números y en letras, el medio y la fecha de pago (pasa). |
| - Probar verificar que un cobro con mora muestre los intereses en una línea aparte (pasa). |
| - Probar intentar modificar un comprobante emitido (falla). |
| - Probar imprimir el comprobante y verificar que se imprima solo la hoja en A4 (pasa). |
| - Probar descargar el PDF y verificar que tenga el mismo contenido que la hoja y el número en el nombre del archivo (pasa). |
| - Probar consultar el comprobante en un ancho de 390 px y descargar el PDF (pasa). |
