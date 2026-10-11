import { Router } from 'express';

import misAlquileresRoutes from './mis-alquileres.routes';
import inmueblesRoutes from './inmuebles.routes';
import usuariosRoutes from './usuarios.routes';
import registrarUsuarioRoutes from './registrar-usuario.routes';
import locadoresRoutes from './locadores.routes';
import solicitudesRoutes from './solicitudes.routes';

const v1Router = Router();

// Rutas versión 1
v1Router.use('/mis-alquileres', misAlquileresRoutes);
v1Router.use('/inmuebles', inmueblesRoutes);
v1Router.use('/usuarios', usuariosRoutes);
v1Router.use('/registrar-usuario', registrarUsuarioRoutes);
v1Router.use('/locadores', locadoresRoutes);
v1Router.use('/solicitudes', solicitudesRoutes);

export default v1Router;