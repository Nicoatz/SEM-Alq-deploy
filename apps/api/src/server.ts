import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { app } from './app';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 RentAR API Gateway iniciado en el puerto ${PORT}`);
  console.log(`👉 Rutas API Gateway versionadas (v1):`);
  console.log(`   - Mis Alquileres (Locador): http://localhost:${PORT}/api/v1/mis-alquileres`);
  console.log(`   - Inmuebles CRUD:           http://localhost:${PORT}/api/v1/inmuebles`);
  console.log(`   - Registrar usuario:           http://localhost:${PORT}/api/v1/registrar-usuario`);
  console.log(`   - Gateway Health:           http://localhost:${PORT}/api/health`);
  console.log(`📚 Documentación Swagger (v1): http://localhost:${PORT}/api/v1/docs`);
  console.log(`====================================================`);
});
