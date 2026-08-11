import { Router } from 'express';
import { body } from 'express-validator';
import {
  listProducts, getProduct, createProduct, updateProduct, listMovements, addMovement,
} from '../controllers/products.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

router.use(authenticate);

router.get('/', listProducts);
router.get('/:id', getProduct);
router.get('/:id/movements', listMovements);

router.post(
  '/',
  authorize('admin', 'warehouse'),
  [
    body('name').notEmpty().withMessage('Product name is required'),
    body('sku').notEmpty().withMessage('SKU is required'),
    body('unit_price').isFloat({ min: 0 }).withMessage('Unit price must be a non-negative number'),
    body('current_stock').optional().isInt({ min: 0 }),
    body('min_stock_alert').optional().isInt({ min: 0 }),
  ],
  validate,
  createProduct
);

router.put('/:id', authorize('admin', 'warehouse'), updateProduct);

router.post(
  '/:id/movements',
  authorize('admin', 'warehouse'),
  [
    body('quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
    body('movement_type').isIn(['IN', 'OUT']).withMessage('movement_type must be IN or OUT'),
  ],
  validate,
  addMovement
);

export default router;
