import { Router } from 'express';
import { body } from 'express-validator';
import {
  listChallans, getChallan, createChallan, updateChallan, confirmChallan, cancelChallan,
} from '../controllers/challans.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

router.use(authenticate);

router.get('/', listChallans);
router.get('/:id', getChallan);

router.post(
  '/',
  authorize('admin', 'sales'),
  [
    body('customer_id').isInt().withMessage('customer_id is required'),
    body('items').isArray({ min: 1 }).withMessage('At least one product line item is required'),
    body('items.*.product_id').isInt().withMessage('Each item needs a product_id'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Each item needs a quantity of at least 1'),
    body('status').optional().isIn(['draft', 'confirmed']),
  ],
  validate,
  createChallan
);

router.put('/:id', authorize('admin', 'sales'), updateChallan);
router.post('/:id/confirm', authorize('admin', 'sales', 'warehouse'), confirmChallan);
router.post('/:id/cancel', authorize('admin', 'sales'), cancelChallan);

export default router;
