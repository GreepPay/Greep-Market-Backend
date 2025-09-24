import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { TransactionService } from '../services/transactionService';
import { AuditService } from '../services/auditService';
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
    const storeId = req.query.store_id as string;
    const status = req.query.status as string;
    const paymentMethod = req.query.payment_method as string;

    const result = await TransactionService.getTransactions(storeId, status, paymentMethod);
    
    res.json({
      success: true,
      data: result.transactions,
      total: result.total
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
    
    // Prepare detailed transaction information for audit log
    const transactionDetails = {
      transaction_id: transaction._id,
      total_amount: transaction.total_amount,
      subtotal: transaction.subtotal,
      discount_amount: transaction.discount_amount,
      tax_amount: transaction.tax_amount,
      payment_method: transaction.payment_method,
      payment_status: transaction.payment_status,
      status: transaction.status,
      item_count: transaction.items.length,
      items: transaction.items.map(item => ({
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
        discount_amount: item.discount_amount || 0
      })),
      cashier_id: transaction.cashier_id,
      store_id: transaction.store_id,
      customer_id: transaction.customer_id || null,
      notes: transaction.notes || null
    };

    // Log the transaction creation with detailed information
    await AuditService.logCreate(
      req,
      'TRANSACTION',
      transaction._id,
      `Transaction ${transaction._id} - ${transaction.items.length} items, Total: $${transaction.total_amount.toFixed(2)}`,
      {
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        store_id: transaction.store_id,
        additional_info: transactionDetails
      }
    );
    
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

    // Prepare detailed completion information for audit log
    const completionDetails = {
      transaction_id: id,
      total_amount: transaction.total_amount,
      payment_method: transaction.payment_method,
      payment_status: payment_status || 'completed',
      item_count: transaction.items.length,
      items_summary: transaction.items.map(item => ({
        product_name: item.product_name,
        quantity: item.quantity,
        total_price: item.total_price
      })),
      completed_by: (req as any).user.email,
      completion_reason: 'Transaction completed successfully'
    };

    // Log the transaction completion with detailed information
    await AuditService.logUpdate(
      req,
      'TRANSACTION',
      id,
      `Transaction ${id} completed - Total: $${transaction.total_amount.toFixed(2)}, Payment: ${payment_status || 'completed'}`,
      { status: 'pending' },
      { status: 'completed', payment_status: payment_status || 'completed' },
      {
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        store_id: transaction.store_id,
        additional_info: completionDetails
      }
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

    // Prepare detailed cancellation information for audit log
    const cancellationDetails = {
      transaction_id: id,
      total_amount: transaction.total_amount,
      payment_method: transaction.payment_method,
      item_count: transaction.items.length,
      items_summary: transaction.items.map(item => ({
        product_name: item.product_name,
        quantity: item.quantity,
        total_price: item.total_price
      })),
      cancelled_by: (req as any).user.email,
      cancellation_reason: 'Transaction cancelled by user',
      refund_status: 'refunded'
    };

    // Log the transaction cancellation with detailed information
    await AuditService.logUpdate(
      req,
      'TRANSACTION',
      id,
      `Transaction ${id} cancelled - Total: $${transaction.total_amount.toFixed(2)}, Refunded`,
      { status: 'pending' },
      { status: 'cancelled', payment_status: 'refunded' },
      {
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        store_id: transaction.store_id,
        additional_info: cancellationDetails
      }
    );

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
