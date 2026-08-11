import { Router } from 'express';
import { body } from 'express-validator';
import {
  listCustomers, getCustomer, createCustomer, updateCustomer, addCustomerNote,
} from '../controllers/customers.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

router.use(authenticate);

// All authenticated roles can view customers
router.get('/', listCustomers);
router.get('/:id', getCustomer);

// Sales and Admin can create/edit customers and add follow-up notes
router.post(
  '/',
  authorize('admin', 'sales'),
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('mobile').notEmpty().withMessage('Mobile number is required'),
    body('email').optional({ nullable: true }).isEmail().withMessage('Email must be valid'),
    body('customer_type').optional().isIn(['retail', 'wholesale', 'distributor']),
    body('status').optional().isIn(['lead', 'active', 'inactive']),
  ],
  validate,
  createCustomer
);

router.put('/:id', authorize('admin', 'sales'), updateCustomer);

router.post(
  '/:id/notes',
  authorize('admin', 'sales'),
  [body('note').notEmpty().withMessage('Note text is required')],
  validate,
  addCustomerNote
);

export default router;
