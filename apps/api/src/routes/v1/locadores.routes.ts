import { Router } from 'express';
import { misAlquileresController } from '../../controllers/mis-alquileres.controller';
import { authenticateGateway, requireRole } from '../../gateway/middlewares/auth.middleware';

const router = Router();

router.get(
  '/:idLocador/barrios',
  authenticateGateway,
  requireRole('locador'),
  misAlquileresController.getBarrios.bind(misAlquileresController)
);

export default router;