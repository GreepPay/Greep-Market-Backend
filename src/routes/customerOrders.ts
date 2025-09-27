import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { CustomerOrderService } from '../services/customerOrderService';
import { OrderStatus, PaymentMethod, DeliveryMethod } from '../models/CustomerOrder';
import { TransactionService } from '../services/transactionService';
import { logger } from '../utils/logger';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Validation rules
const updateOrderStatusValidation = [
  param('id').isMongoId().withMessage('Valid order ID is required'),
  body('status')
    .isIn(Object.values(OrderStatus))
    .withMessage('Valid order status is required'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes must not exceed 1000 characters')
];

/**
 * @route   GET /api/v1/admin/customer-orders
 * @desc    Get customer orders with filters (Admin/Owner/Manager only)
 * @access  Private (Admin/Owner/Manager)
 */
router.get('/', authorize('admin', 'owner', 'manager'), [
  query('store_id').optional().trim(),
  query('status').optional().isIn(Object.values(OrderStatus)),
  query('customer_phone').optional().trim(),
  query('start_date').optional().isISO8601(),
  query('end_date').optional().isISO8601(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  try {
    const {
      store_id,
      status,
      customer_phone,
      start_date,
      end_date,
      page,
      limit
    } = req.query;

    const filters = {
      store_id: store_id as string || (req as any).user.storeId || 'default-store',
      status: status as OrderStatus,
      customer_phone: customer_phone as string,
      start_date: start_date ? new Date(start_date as string) : undefined,
      end_date: end_date ? new Date(end_date as string) : undefined,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 20
    };

    const result = await CustomerOrderService.getOrders(filters);

    res.json({
      success: true,
      message: 'Customer orders retrieved successfully',
      data: result
    });
  } catch (error) {
    logger.error('Error getting customer orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve customer orders',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * @route   GET /api/v1/admin/customer-orders/:id
 * @desc    Get customer order by ID
 * @access  Private (Admin/Owner/Manager)
 */
router.get('/:id', authorize('admin', 'owner', 'manager'), [
  param('id').isMongoId().withMessage('Valid order ID is required')
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  try {
    const { id } = req.params;
    const order = await CustomerOrderService.getOrderById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if user has access to this order's store
    const userStoreId = (req as any).user.storeId || 'default-store';
    if (order.store_id !== userStoreId && (req as any).user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this order'
      });
    }

    res.json({
      success: true,
      message: 'Order retrieved successfully',
      data: order
    });
  } catch (error) {
    logger.error('Error getting customer order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve order',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * @route   PUT /api/v1/admin/customer-orders/:id/status
 * @desc    Update customer order status
 * @access  Private (Admin/Owner/Manager)
 */
router.put('/:id/status', authorize('admin', 'owner', 'manager'), updateOrderStatusValidation, asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    // Check if order exists and user has access
    const existingOrder = await CustomerOrderService.getOrderById(id);
    if (!existingOrder) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const userStoreId = (req as any).user.storeId || 'default-store';
    if (existingOrder.store_id !== userStoreId && (req as any).user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this order'
      });
    }

    const updatedOrder = await CustomerOrderService.updateOrderStatus(id, status, notes);

    res.json({
      success: true,
      message: 'Order status updated successfully',
      data: updatedOrder
    });
  } catch (error) {
    logger.error('Error updating order status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update order status',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * @route   POST /api/v1/admin/customer-orders/:id/whatsapp-sent
 * @desc    Mark WhatsApp message as sent
 * @access  Private (Admin/Owner/Manager)
 */
router.post('/:id/whatsapp-sent', authorize('admin', 'owner', 'manager'), [
  param('id').isMongoId().withMessage('Valid order ID is required')
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  try {
    const { id } = req.params;
    
    // Check if order exists and user has access
    const existingOrder = await CustomerOrderService.getOrderById(id);
    if (!existingOrder) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const userStoreId = (req as any).user.storeId || 'default-store';
    if (existingOrder.store_id !== userStoreId && (req as any).user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this order'
      });
    }

    const updatedOrder = await CustomerOrderService.markWhatsAppSent(id);

    res.json({
      success: true,
      message: 'WhatsApp marked as sent',
      data: updatedOrder
    });
  } catch (error) {
    logger.error('Error marking WhatsApp as sent:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark WhatsApp as sent',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * @route   POST /api/v1/admin/customer-orders/:id/convert-to-transaction
 * @desc    Convert customer order to transaction
 * @access  Private (Admin/Owner/Manager)
 */
router.post('/:id/convert-to-transaction', authorize('admin', 'owner', 'manager'), [
  param('id').isMongoId().withMessage('Valid order ID is required')
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  try {
    const { id } = req.params;
    const userId = (req as any).user.id;

    // Check if order exists and user has access
    const existingOrder = await CustomerOrderService.getOrderById(id);
    if (!existingOrder) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const userStoreId = (req as any).user.storeId || 'default-store';
    if (existingOrder.store_id !== userStoreId && (req as any).user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this order'
      });
    }

    // Convert order to transaction data
    const transactionData = await CustomerOrderService.convertToTransaction(id, userId);

    // Create the actual transaction using TransactionService
    const transaction = await TransactionService.createTransaction(transactionData);

    // Update order status to completed
    await CustomerOrderService.updateOrderStatus(id, OrderStatus.COMPLETED, 'Converted to transaction');

    logger.info(`Customer order ${existingOrder.order_number} converted to transaction ${transaction._id}`);

    res.json({
      success: true,
      message: 'Order converted to transaction successfully',
      data: {
        order: existingOrder,
        transaction: transaction
      }
    });
  } catch (error) {
    logger.error('Error converting order to transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to convert order to transaction',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * @route   GET /api/v1/admin/customer-orders/stats/overview
 * @desc    Get customer order statistics
 * @access  Private (Admin/Owner/Manager)
 */
router.get('/stats/overview', authorize('admin', 'owner', 'manager'), [
  query('store_id').optional().trim(),
  query('start_date').optional().isISO8601(),
  query('end_date').optional().isISO8601()
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  try {
    const storeId = req.query.store_id as string || (req as any).user.storeId || 'default-store';
    const startDate = req.query.start_date ? new Date(req.query.start_date as string) : undefined;
    const endDate = req.query.end_date ? new Date(req.query.end_date as string) : undefined;

    const stats = await CustomerOrderService.getOrderStats(storeId, startDate, endDate);

    res.json({
      success: true,
      message: 'Order statistics retrieved successfully',
      data: stats
    });
  } catch (error) {
    logger.error('Error getting order statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve order statistics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * @route   GET /api/v1/admin/customer-orders/:id/whatsapp-link
 * @desc    Get WhatsApp share link for order
 * @access  Private (Admin/Owner/Manager)
 */
router.get('/:id/whatsapp-link', authorize('admin', 'owner', 'manager'), [
  param('id').isMongoId().withMessage('Valid order ID is required')
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  try {
    const { id } = req.params;
    const order = await CustomerOrderService.getOrderById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const userStoreId = (req as any).user.storeId || 'default-store';
    if (order.store_id !== userStoreId && (req as any).user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this order'
      });
    }

    const whatsappLink = CustomerOrderService.generateWhatsAppLink(
      order.order_number,
      order.customer_name
    );

    res.json({
      success: true,
      message: 'WhatsApp link generated successfully',
      data: {
        whatsapp_link: whatsappLink,
        order_message: order.whatsapp_message,
        order_number: order.order_number,
        customer_name: order.customer_name
      }
    });
  } catch (error) {
    logger.error('Error generating WhatsApp link:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate WhatsApp link',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

export default router;
