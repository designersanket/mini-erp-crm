import { Router } from 'express';
import { body } from 'express-validator';
import { listUsers, createUser, deactivateUser } from '../controllers/users.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

router.use(authenticate, authorize('admin'));

router.get('/', listUsers);

router.post(
  '/',
  [
    body('name').notEmpty(),
    body('email').isEmail(),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').isIn(['admin', 'sales', 'warehouse', 'accounts']),
  ],
  validate,
  createUser
);

router.delete('/:id', deactivateUser);

export default router;
