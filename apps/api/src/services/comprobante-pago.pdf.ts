import { PDFDocument, PageSizes, StandardFonts, rgb } from 'pdf-lib';
import type { ComprobantePagoDTO } from '../dtos';

const MARGIN = 48;
const LINE_HEIGHT = 16;
const PAGE_WIDTH = PageSizes.A4[0];
const PAGE_HEIGHT = PageSizes.A4[1];

function dinero(monto: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(monto);
}

function numeroEnLetras(numero: number): string {
  const unidades = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
  const especiales = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince'];
  const decenas = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
  const entero = Math.floor(numero);

  if (entero < 10) return unidades[entero];
  if (entero < 16) return especiales[entero - 10];
  if (entero < 20) return `dieci${unidades[entero - 10]}`;
  if (entero < 30) return entero === 20 ? 'veinte' : `veinti${unidades[entero - 20]}`;
  if (entero < 100) {
    const decena = Math.floor(entero / 10);
    const unidad = entero % 10;
    return unidad === 0 ? decenas[decena] : `${decenas[decena]} y ${unidades[unidad]}`;
  }
  if (entero < 1000) {
    if (entero === 100) return 'cien';
    const centenas = Math.floor(entero / 100);
    const resto = entero % 100;
    const nombre = ['', '', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'][centenas];
    return resto === 0 ? nombre : `${nombre} ${numeroEnLetras(resto)}`;
  }
  if (entero < 1000000) {
    const miles = Math.floor(entero / 1000);
    const resto = entero % 1000;
    const nombreMiles = miles === 1 ? 'mil' : `${numeroEnLetras(miles)} mil`;
    return resto === 0 ? nombreMiles : `${nombreMiles} ${numeroEnLetras(resto)}`;
  }

  return String(entero);
}

function totalEnLetras(monto: number): string {
  const entero = Math.floor(monto);
  const centavos = Math.round((monto - entero) * 100);
  return `${numeroEnLetras(entero)} pesos con ${String(centavos).padStart(2, '0')} centavos`;
}

function fechaHora(fecha: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date(fecha));
}

function fecha(fechaTexto: string | null): string {
  if (!fechaTexto) return 'No informada';
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeZone: 'UTC' }).format(new Date(`${fechaTexto}T00:00:00Z`));
}

export async function generarComprobantePagoPdf(comprobante: ComprobantePagoDTO): Promise<Buffer> {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  let page = document.addPage(PageSizes.A4);
  let y = PAGE_HEIGHT - MARGIN;

  const text = (value: string, x = MARGIN, size = 10, font = regular) => {
    page.drawText(value, { x, y, size, font, color: rgb(0.12, 0.14, 0.18) });
    y -= LINE_HEIGHT;
  };

  const section = (title: string) => {
    y -= 8;
    page.drawText(title, { x: MARGIN, y, size: 12, font: bold, color: rgb(0.05, 0.32, 0.42) });
    y -= 22;
  };

  const ensureSpace = (height: number) => {
    if (y - height < MARGIN) {
      page = document.addPage(PageSizes.A4);
      y = PAGE_HEIGHT - MARGIN;
    }
  };

  page.drawText('RentAR', { x: MARGIN, y, size: 24, font: bold, color: rgb(0.05, 0.32, 0.42) });
  page.drawText('COMPROBANTE DE PAGO', { x: 340, y: y + 2, size: 11, font: bold, color: rgb(0.12, 0.14, 0.18) });
  y -= 28;
  text(`Número: ${comprobante.numero_comprobante}`, MARGIN, 10, bold);
  text(`Emitido: ${fechaHora(comprobante.fecha_emision)}`);
  text('Estado: Pagado', MARGIN, 10, bold);

  section('Partes');
  text(`Locatario: ${comprobante.locatario.nombre} ${comprobante.locatario.apellido ?? ''}`.trim(), MARGIN, 10, bold);
  text(`DNI/CUIT: ${comprobante.locatario.numero_documento ?? 'No informado'}`);
  text(`Correo: ${comprobante.locatario.email} | Teléfono: ${comprobante.locatario.telefono ?? 'No informado'}`);
  y -= 4;
  text(`Locador: ${comprobante.locador.nombre} ${comprobante.locador.apellido ?? ''}`.trim(), MARGIN, 10, bold);
  text(`DNI/CUIT: ${comprobante.locador.numero_documento ?? 'No informado'}`);
  text(`Correo: ${comprobante.locador.email} | Teléfono: ${comprobante.locador.telefono ?? 'No informado'}`);

  section('Propiedad y contrato');
  text(`Propiedad: ${comprobante.propiedad.direccion} ${comprobante.propiedad.numero}${comprobante.propiedad.piso ? `, piso ${comprobante.propiedad.piso}` : ''}`);
  text(`Barrio: ${comprobante.propiedad.barrio} | Ciudad: ${comprobante.propiedad.ciudad}`);
  text(`Contrato: ${comprobante.contrato.codigo ?? `#${comprobante.contrato.id}`}`);
  text(`Vigencia: ${fecha(comprobante.contrato.fecha_inicio)} a ${fecha(comprobante.contrato.fecha_fin)}`);
  text(`Período imputado: ${comprobante.periodo.periodo} (${fecha(comprobante.periodo.fecha_inicio)} a ${fecha(comprobante.periodo.fecha_fin)})`);
  text(`Vencimiento: ${fecha(comprobante.periodo.fecha_vencimiento)}`);

  section('Detalle del pago');
  for (const cargo of comprobante.cargos) {
    ensureSpace(40);
    const concepto = cargo.concepto === 'alquiler' ? `Alquiler del período ${comprobante.periodo.periodo}` : `Intereses por mora (${cargo.diasMora ?? 0} días)`;
    text(concepto, MARGIN, 10, regular);
    page.drawText(dinero(cargo.monto), { x: 420, y: y + LINE_HEIGHT, size: 10, font: regular, color: rgb(0.12, 0.14, 0.18) });
  }
  y -= 4;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 1, color: rgb(0.78, 0.81, 0.83) });
  y -= 20;
  text(`Total pagado: ${dinero(comprobante.total_pagado)}`, MARGIN, 13, bold);
  text(`En letras: ${comprobante.total_en_letras}`, MARGIN, 10, regular);
  text(`Medio de pago: ${comprobante.medio}`);
  text(`Fecha del pago: ${fecha(comprobante.fecha_cobro)}`);
  if (comprobante.nota) text(`Nota: ${comprobante.nota}`);

  y -= 20;
  page.drawText('Comprobante emitido por RentAR. No válido como factura.', {
    x: MARGIN,
    y,
    size: 9,
    font: regular,
    color: rgb(0.35, 0.38, 0.42),
  });

  return Buffer.from(await document.save());
}

export { totalEnLetras };
