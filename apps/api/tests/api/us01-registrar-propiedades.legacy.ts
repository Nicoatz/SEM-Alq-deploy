import http from 'http';
import { app } from '../../src/app';
import { inmuebleRepository } from '../../src/repositories/inmueble.repository';

let server: http.Server;
let baseUrl: string;

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function getPayloadValido() {
  return {
    tipo: 1, // Departamento (no monoambiente)
    descripcion: 'Departamento céntrico luminoso',
    provincia: 'Córdoba',
    ciudad: 'Córdoba',
    barrio: 'Centro',
    direccion: 'San Jerónimo',
    numero: 280,
    piso: '3A',
    m2_totales: 65,
    m2_cubiertos: 60,
    ambientes: 3,
    dormitorios: 2,
    banos: 1,
    antiguedad: 4,
    precio_publicado: 380000,
    estado_alquiler: 'publicado',
    tags: [1, 2],
    fotos: [
      { url: 'https://rentar.com/fotos/foto1.jpg', peso_kb: 200, formato: 'jpg' },
      { url: 'https://rentar.com/fotos/foto2.jpg', peso_kb: 150, formato: 'jpg' },
      { url: 'https://rentar.com/fotos/foto3.png', peso_kb: 300, formato: 'png' }
    ],
    condiciones_contrato: {
      monto_alquiler: 360000,
      expensas: 40000,
      indice_aumento: 1,
      frecuencia_ajuste: 'Semestral',
      duracion_meses: 24,
      deposito: 360000,
      interes_por_dia: 0.5,
      dias_gracia: 5,
      medios_pago: [1, 3]
    }
  };
}

type TestFn = () => Promise<void>;

interface TestCase {
  name: string;
  fn: TestFn;
}

const tests: TestCase[] = [];
let idInmuebleCreado: number;

function test(name: string, fn: TestFn) {
  tests.push({ name, fn });
}

// -------------------------------------------------------------------------
// Definición de pruebas individuales
// -------------------------------------------------------------------------

test('1. Registrar sin contar con una sesión iniciada (falla 401)', async () => {
  const res = await fetch(`${baseUrl}/api/v1/inmuebles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': 'invalido' },
    body: JSON.stringify(getPayloadValido())
  });
  assert(res.status === 401, `Esperado 401, recibido ${res.status}`);
});

test('2. Registrar sin haber adjuntado ninguna foto (falla 400)', async () => {
  const payload = getPayloadValido();
  (payload as any).fotos = [];
  const res = await fetch(`${baseUrl}/api/v1/inmuebles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': '1' },
    body: JSON.stringify(payload)
  });
  assert(res.status === 400, `Esperado 400, recibido ${res.status}`);
});

test('3. Registrar con menos de 3 fotos (falla 400)', async () => {
  const payload = getPayloadValido();
  payload.fotos = [
    { url: 'https://rentar.com/1.jpg', peso_kb: 200, formato: 'jpg' },
    { url: 'https://rentar.com/2.jpg', peso_kb: 200, formato: 'jpg' }
  ];
  const res = await fetch(`${baseUrl}/api/v1/inmuebles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': '1' },
    body: JSON.stringify(payload)
  });
  assert(res.status === 400, `Esperado 400, recibido ${res.status}`);
});

test('4. Registrar con más de 50 fotos (falla 400)', async () => {
  const payload = getPayloadValido();
  payload.fotos = Array.from({ length: 51 }, (_, i) => ({
    url: `https://rentar.com/${i}.jpg`,
    peso_kb: 100,
    formato: 'jpg'
  }));
  const res = await fetch(`${baseUrl}/api/v1/inmuebles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': '1' },
    body: JSON.stringify(payload)
  });
  assert(res.status === 400, `Esperado 400, recibido ${res.status}`);
});

test('5. Cargar foto en formato diferente a JPG o PNG (falla 400)', async () => {
  const payload = getPayloadValido();
  payload.fotos[0].formato = 'gif';
  const res = await fetch(`${baseUrl}/api/v1/inmuebles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': '1' },
    body: JSON.stringify(payload)
  });
  assert(res.status === 400, `Esperado 400, recibido ${res.status}`);
});

test('6. Cargar foto con peso mayor a 350kb (falla 400)', async () => {
  const payload = getPayloadValido();
  payload.fotos[0].peso_kb = 351;
  const res = await fetch(`${baseUrl}/api/v1/inmuebles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': '1' },
    body: JSON.stringify(payload)
  });
  assert(res.status === 400, `Esperado 400, recibido ${res.status}`);
});

test('7. Registrar sin haber ingresado una descripción (pasa 201)', async () => {
  const payload = getPayloadValido();
  delete (payload as any).descripcion;
  const res = await fetch(`${baseUrl}/api/v1/inmuebles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': '1' },
    body: JSON.stringify(payload)
  });
  assert(res.status === 201, `Esperado 201, recibido ${res.status}`);
});

test('8. Registrar sin haber ingresado una calle (falla 400)', async () => {
  const payload = getPayloadValido();
  payload.direccion = '';
  const res = await fetch(`${baseUrl}/api/v1/inmuebles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': '1' },
    body: JSON.stringify(payload)
  });
  assert(res.status === 400, `Esperado 400, recibido ${res.status}`);
});

test('9. Registrar sin haber ingresado una altura de calle (falla 400)', async () => {
  const payload = getPayloadValido();
  delete (payload as any).numero;
  const res = await fetch(`${baseUrl}/api/v1/inmuebles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': '1' },
    body: JSON.stringify(payload)
  });
  assert(res.status === 400, `Esperado 400, recibido ${res.status}`);
});

test('10. Registrar sin haber indicado ciudad, provincia y barrio (falla 400)', async () => {
  const payload = getPayloadValido();
  payload.provincia = '';
  const res = await fetch(`${baseUrl}/api/v1/inmuebles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': '1' },
    body: JSON.stringify(payload)
  });
  assert(res.status === 400, `Esperado 400, recibido ${res.status}`);
});

test('11. Registrar con 0 o menos metros cuadrados (falla 400)', async () => {
  const payload = getPayloadValido();
  payload.m2_totales = 0;
  const res = await fetch(`${baseUrl}/api/v1/inmuebles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': '1' },
    body: JSON.stringify(payload)
  });
  assert(res.status === 400, `Esperado 400, recibido ${res.status}`);
});

test('12. Registrar sin haber seleccionado el tipo de propiedad (falla 400)', async () => {
  const payload = getPayloadValido();
  delete (payload as any).tipo;
  const res = await fetch(`${baseUrl}/api/v1/inmuebles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': '1' },
    body: JSON.stringify(payload)
  });
  assert(res.status === 400, `Esperado 400, recibido ${res.status}`);
});

test('13. Monoambiente con más de un ambiente (falla 400)', async () => {
  const payload = getPayloadValido();
  payload.tipo = 4; // Monoambiente
  payload.ambientes = 2;
  payload.dormitorios = 1;
  const res = await fetch(`${baseUrl}/api/v1/inmuebles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': '1' },
    body: JSON.stringify(payload)
  });
  assert(res.status === 400, `Esperado 400, recibido ${res.status}`);
});

test('14. Monoambiente con más de un dormitorio (falla 400)', async () => {
  const payload = getPayloadValido();
  payload.tipo = 4; // Monoambiente
  payload.ambientes = 1;
  payload.dormitorios = 2;
  const res = await fetch(`${baseUrl}/api/v1/inmuebles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': '1' },
    body: JSON.stringify(payload)
  });
  assert(res.status === 400, `Esperado 400, recibido ${res.status}`);
});

test('15. No monoambiente con menos de 2 ambientes (falla 400)', async () => {
  const payload = getPayloadValido();
  payload.tipo = 1; // Departamento
  payload.ambientes = 1;
  const res = await fetch(`${baseUrl}/api/v1/inmuebles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': '1' },
    body: JSON.stringify(payload)
  });
  assert(res.status === 400, `Esperado 400, recibido ${res.status}`);
});

test('16. No monoambiente con menos de 1 dormitorio (falla 400)', async () => {
  const payload = getPayloadValido();
  payload.tipo = 1; // Departamento
  payload.dormitorios = 0;
  const res = await fetch(`${baseUrl}/api/v1/inmuebles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': '1' },
    body: JSON.stringify(payload)
  });
  assert(res.status === 400, `Esperado 400, recibido ${res.status}`);
});

test('17. Registrar con 0 o menos baños (falla 400)', async () => {
  const payload = getPayloadValido();
  payload.banos = 0;
  const res = await fetch(`${baseUrl}/api/v1/inmuebles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': '1' },
    body: JSON.stringify(payload)
  });
  assert(res.status === 400, `Esperado 400, recibido ${res.status}`);
});

test('18. Registrar sin haber ingresado la antigüedad (pasa 201)', async () => {
  const payload = getPayloadValido();
  delete (payload as any).antiguedad;
  const res = await fetch(`${baseUrl}/api/v1/inmuebles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': '1' },
    body: JSON.stringify(payload)
  });
  assert(res.status === 201, `Esperado 201, recibido ${res.status}`);
});

test('19. Registrar sin haber indicado el estado del alquiler (falla 400)', async () => {
  const payload = getPayloadValido();
  delete (payload as any).estado_alquiler;
  const res = await fetch(`${baseUrl}/api/v1/inmuebles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': '1' },
    body: JSON.stringify(payload)
  });
  assert(res.status === 400, `Esperado 400, recibido ${res.status}`);
});

test('20. Registrar sin haber seleccionado tags (pasa 201)', async () => {
  const payload = getPayloadValido();
  payload.tags = [];
  const res = await fetch(`${baseUrl}/api/v1/inmuebles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': '1' },
    body: JSON.stringify(payload)
  });
  assert(res.status === 201, `Esperado 201, recibido ${res.status}`);
});

test('21. Registrar seleccionando uno o más tags (pasa 201)', async () => {
  const payload = getPayloadValido();
  payload.tags = [1, 2, 3];
  const res = await fetch(`${baseUrl}/api/v1/inmuebles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': '1' },
    body: JSON.stringify(payload)
  });
  assert(res.status === 201, `Esperado 201, recibido ${res.status}`);
});

test('22. Registrar sin ingresar un monto de alquiler (falla 400)', async () => {
  const payload = getPayloadValido();
  delete (payload.condiciones_contrato as any).monto_alquiler;
  const res = await fetch(`${baseUrl}/api/v1/inmuebles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': '1' },
    body: JSON.stringify(payload)
  });
  assert(res.status === 400, `Esperado 400, recibido ${res.status}`);
});

test('23. Registrar sin ingresar un monto de expensas (falla 400)', async () => {
  const payload = getPayloadValido();
  delete (payload.condiciones_contrato as any).expensas;
  const res = await fetch(`${baseUrl}/api/v1/inmuebles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': '1' },
    body: JSON.stringify(payload)
  });
  assert(res.status === 400, `Esperado 400, recibido ${res.status}`);
});

test('24. Registrar sin seleccionar un índice de actualización (pasa 201)', async () => {
  const payload = getPayloadValido();
  delete (payload.condiciones_contrato as any).indice_aumento;
  const res = await fetch(`${baseUrl}/api/v1/inmuebles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': '1' },
    body: JSON.stringify(payload)
  });
  assert(res.status === 201, `Esperado 201, recibido ${res.status}`);
});

test('25. Registrar sin medios de pago asociados (falla 400)', async () => {
  const payload = getPayloadValido();
  payload.condiciones_contrato.medios_pago = [];
  const res = await fetch(`${baseUrl}/api/v1/inmuebles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': '1' },
    body: JSON.stringify(payload)
  });
  assert(res.status === 400, `Esperado 400, recibido ${res.status}`);
  const json = await res.json();
  assert(json.error.includes('al menos una forma de pago'), 'Mensaje debe exigir al menos una forma de pago');
});

test('26. Interés por día pero sin días de gracia (falla 400)', async () => {
  const payload = getPayloadValido();
  payload.condiciones_contrato.interes_por_dia = 0.8;
  delete (payload.condiciones_contrato as any).dias_gracia;
  const res = await fetch(`${baseUrl}/api/v1/inmuebles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': '1' },
    body: JSON.stringify(payload)
  });
  assert(res.status === 400, `Esperado 400, recibido ${res.status}`);
});

test('27. Interés por día con días de gracia (pasa 201)', async () => {
  const payload = getPayloadValido();
  payload.condiciones_contrato.interes_por_dia = 0.8;
  payload.condiciones_contrato.dias_gracia = 7;
  const res = await fetch(`${baseUrl}/api/v1/inmuebles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': '1' },
    body: JSON.stringify(payload)
  });
  assert(res.status === 201, `Esperado 201, recibido ${res.status}`);
});

test('28. Transaccionalidad atómica — rollback ante fallo', async () => {
  const totalAntes = (await inmuebleRepository.findAll()).length;
  const payload = getPayloadValido();
  payload.condiciones_contrato.medios_pago = []; // Fuerza el fallo al final
  await fetch(`${baseUrl}/api/v1/inmuebles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': '1' },
    body: JSON.stringify(payload)
  });
  const totalDespues = (await inmuebleRepository.findAll()).length;
  assert(totalAntes === totalDespues, 'La transacción debe revertirse y no dejar inmuebles huérfanos');
});

test('29. Registro exitoso completo con foto principal por defecto (pasa 201)', async () => {
  const payload = getPayloadValido();
  payload.direccion = 'Bv. San Juan';
  payload.numero = 550;
  payload.precio_publicado = 420000;
  payload.condiciones_contrato.monto_alquiler = 400000;

  const res = await fetch(`${baseUrl}/api/v1/inmuebles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': '1' },
    body: JSON.stringify(payload)
  });
  assert(res.status === 201, `Esperado 201, recibido ${res.status}`);
  const json = await res.json();
  idInmuebleCreado = json.data.id;
  assert(typeof idInmuebleCreado === 'number', 'Debe retornar ID autogenerado');
});

test('30. Consulta en /api/v1/mis-alquileres refleja la nueva propiedad', async () => {
  const res = await fetch(`${baseUrl}/api/v1/mis-alquileres`, {
    headers: { 'x-user-id': '1' }
  });
  assert(res.status === 200, `Esperado 200, recibido ${res.status}`);
  const json = await res.json();
  const item = json.data.find((p: any) => p.id_inmueble === idInmuebleCreado);

  assert(!!item, 'La propiedad recién creada debe figurar en mis alquileres');
  assert(item.titulo_direccion.includes('Bv. San Juan 550'), 'El título debe ser la dirección formateada');
  assert(item.precio_publicado === 420000, 'Precio publicado debe ser 420000');
  assert(item.contrato.monto_alquiler === 400000, 'Monto alquiler contrato debe ser 400000');
  assert(item.contrato.medios_pago.length >= 1, 'Debe incluir los medios de pago asociados');
  assert(item.foto_principal === 'https://rentar.com/fotos/foto1.jpg', 'La primera foto debe ser la principal por defecto');
});

// -------------------------------------------------------------------------
// Runner
// -------------------------------------------------------------------------

async function runTests() {
  console.log('🧪 Ejecutando suite completa de pruebas para US-01 (Registrar mis propiedades)...\n');

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const address = server.address();
      if (address && typeof address === 'object') {
        baseUrl = `http://localhost:${address.port}`;
        resolve();
      }
    });
  });

  let passed = 0;
  let failed = 0;

  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`✅ ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`❌ ${name}`);
      console.error(`   ${err.message}\n`);
      failed++;
    }
  }

  server.close();

  console.log(`\n─────────────────────────────────────────`);
  console.log(`Resultados: ${passed} pasaron, ${failed} fallaron de ${tests.length} pruebas.`);

  if (failed > 0) {
    process.exitCode = 1;
  } else {
    console.log('🎉 ¡Todos los casos de prueba de US-01 han pasado con éxito!');
  }
}

runTests();
