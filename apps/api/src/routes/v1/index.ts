import { Router } from 'express';

import misAlquileresRoutes from './mis-alquileres.routes';
import inmueblesRoutes from './inmuebles.routes';
import usuariosRoutes from './usuarios.routes';
import registrarUsuarioRoutes from './registrar-usuario.routes';
import locadoresRoutes from './locadores.routes';
import solicitudesRoutes from './solicitudes.routes';
import alquileresLocatarioRoutes from './alquileres-locatario.routes';
import contratosRoutes from './contratos.routes';
import cobrosLocadorRoutes from './cobros-locador.routes';
import comprobantesRoutes from './comprobantes.routes';
import cobrosLocatarioRoutes from './cobros-locatario.routes';
import firmaGaranteRoutes from './firma-garante.routes';
import webhooksRoutes from './webhooks.routes';

const v1Router = Router();

// Rutas versión 1
v1Router.use('/mis-alquileres', misAlquileresRoutes);
v1Router.use('/alquileres-locatario', alquileresLocatarioRoutes);
v1Router.use('/inmuebles', inmueblesRoutes);
v1Router.use('/usuarios', usuariosRoutes);
v1Router.use('/registrar-usuario', registrarUsuarioRoutes);
v1Router.use('/locadores', locadoresRoutes);
v1Router.use('/solicitudes', solicitudesRoutes);
v1Router.use('/contratos', contratosRoutes);
v1Router.use('/cobros-locador', cobrosLocadorRoutes);
v1Router.use('/cobros-locatario', cobrosLocatarioRoutes);
v1Router.use('/cobros', comprobantesRoutes);
// Público (sin sesión): el garante firma con un enlace temporal. Ver firma-garante.routes.ts.
v1Router.use('/firma-garante', firmaGaranteRoutes);
// Lo llama DocuSign (sin sesión): se autentica con la firma HMAC del aviso.
v1Router.use('/webhooks', webhooksRoutes);

export default v1Router;