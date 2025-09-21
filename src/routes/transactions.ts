import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { TransactionService } from '../services/transactionService';
import { logger } from '../utils/logger';

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
    logger.error('Error getting transactions:', error);
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
  try {
    const transactionData = req.body;
    
    // Validate required fields
    if (!transactionData.store_id || !transactionData.items || !transactionData.cashier_id) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: store_id, items, cashier_id'
      });
    }

    // Validate items array
    if (!Array.isArray(transactionData.items) || transactionData.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Items array is required and cannot be empty'
      });
    }

    // Validate each item
    for (const item of transactionData.items) {
      if (!item.product_id || !item.quantity || !item.unit_price) {
        return res.status(400).json({
          success: false,
          message: 'Each item must have product_id, quantity, and unit_price'
        });
      }
    }

    const transaction = await TransactionService.createTransaction(transactionData);
    
    res.status(201).json({
      success: true,
      message: 'Transaction created successfully',
      data: transaction
    });
  } catch (error) {
    logger.error('Error creating transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create transaction',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * @route   GET /api/v1/transactions/:id
 * @desc    Get transaction by ID
 * @access  Private
 */
router.get('/:id', asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    
    const transaction = await TransactionService.getTransactionById(id);
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    res.json({
      success: true,
      data: transaction
    });
  } catch (error) {
    logger.error('Error getting transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get transaction',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * @route   POST /api/v1/transactions/:id/complete
 * @desc    Complete transaction
 * @access  Private
 */
router.post('/:id/complete', asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_status } = req.body;

    const transaction = await TransactionService.updateTransactionStatus(
      id, 
      'completed', 
      payment_status || 'completed'
    );

    res.json({
      success: true,
      message: 'Transaction completed successfully',
      data: transaction
    });
  } catch (error) {
    logger.error('Error completing transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete transaction',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * @route   POST /api/v1/transactions/:id/cancel
 * @desc    Cancel transaction
 * @access  Private
 */
router.post('/:id/cancel', asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const transaction = await TransactionService.cancelTransaction(id);

    res.json({
      success: true,
      message: 'Transaction cancelled successfully',
      data: transaction
    });
  } catch (error) {
    logger.error('Error cancelling transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel transaction',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

export default router;
