import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { TransactionService } from '../services/transactionService';

const router = Router();

// All transaction routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/v1/transactions
 * @desc    Get transactions
 * @access  Private
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const storeId = req.query.store_id as string;
    const status = req.query.status as string;
    const paymentMethod = req.query.payment_method as string;

    const result = await TransactionService.getTransactions(page, limit, storeId, status, paymentMethod);
    
    res.json({
      success: true,
      data: result.transactions,
      pagination: {
        total: result.total,
        page: result.page,
        pages: result.pages,
        limit
      }
    });
  } catch (error) {
    console.error('Error getting transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get transactions',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}));

/**
 * @route   POST /api/v1/transactions
 * @desc    Create transaction
 * @access  Private
 */
router.post('/', asyncHandler(async (req, res) => {
  // Mock response for now
  res.json({
    success: true,
    data: { id: 'mock-transaction-id' },
    message: 'Transaction created - to be implemented'
  });
}));

/**
 * @route   POST /api/v1/transactions/:id/complete
 * @desc    Complete transaction
 * @access  Private
 */
router.post('/:id/complete', asyncHandler(async (req, res) => {
  // Mock response for now
  res.json({
    success: true,
    message: 'Transaction completed - to be implemented'
  });
}));

export default router;
