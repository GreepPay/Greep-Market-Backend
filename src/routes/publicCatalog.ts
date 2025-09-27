import { Router, Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { asyncHandler } from '../middleware/errorHandler';
import { ProductService } from '../services/productService';
import { CustomerOrderService } from '../services/customerOrderService';
import { PaymentMethod, DeliveryMethod } from '../models/CustomerOrder';
import { logger } from '../utils/logger';

const router = Router();

// Validation rules
const createOrderValidation = [
  body('customer_name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Customer name must be between 2 and 100 characters'),
  body('customer_phone')
    .trim()
    .isLength({ min: 10, max: 20 })
    .withMessage('Valid phone number is required'),
  body('customer_email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('store_id')
    .trim()
    .notEmpty()
    .withMessage('Store ID is required'),
  body('items')
    .isArray({ min: 1 })
    .withMessage('At least one item is required'),
  body('items.*.product_id')
    .trim()
    .notEmpty()
    .withMessage('Product ID is required'),
  body('items.*.quantity')
    .isInt({ min: 1 })
    .withMessage('Quantity must be at least 1'),
  body('payment_method')
    .isIn(Object.values(PaymentMethod))
    .withMessage('Valid payment method is required'),
  body('delivery_method')
    .isIn(Object.values(DeliveryMethod))
    .withMessage('Valid delivery method is required'),
  body('delivery_address')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Delivery address must not exceed 500 characters'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes must not exceed 1000 characters')
];

/**
 * @route   GET /api/v1/public/catalog
 * @desc    Get public product catalog
 * @access  Public
 */
router.get('/catalog', [
  query('store_id').optional().trim().notEmpty().withMessage('Valid store ID is required'),
  query('category').optional().trim(),
  query('search').optional().trim(),
  query('is_active').optional().isBoolean(),
  query('sortBy').optional().isIn(['name', 'price', 'created_at']),
  query('sortOrder').optional().isIn(['asc', 'desc'])
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const storeId = req.query.store_id as string || 'default-store';
  const category = req.query.category as string;
  const search = req.query.search as string;
  const isActive = req.query.is_active === 'true';
  const sortBy = req.query.sortBy as string || 'name';
  const sortOrder = req.query.sortOrder as 'asc' | 'desc' || 'asc';

  try {
    const result = await ProductService.getProducts({
      store_id: storeId,
      category,
      search,
      is_active: isActive !== undefined ? isActive : true, // Default to active products only
      is_featured: undefined,
      sortBy,
      sortOrder
    });

    res.json({
      success: true,
      message: 'Catalog retrieved successfully',
      data: result
    });
  } catch (error) {
    logger.error('Error getting public catalog:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve catalog',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * @route   GET /api/v1/public/products
 * @desc    Get products for public catalog (alias for /catalog)
 * @access  Public
 */
router.get('/products', [
  query('store_id').optional().trim().notEmpty().withMessage('Valid store ID is required'),
  query('category').optional().trim(),
  query('search').optional().trim(),
  query('is_active').optional().isBoolean(),
  query('sortBy').optional().isIn(['name', 'price', 'created_at']),
  query('sortOrder').optional().isIn(['asc', 'desc'])
], asyncHandler(async (req: Request, res: Response) => {
  // Use the same logic as catalog endpoint
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const storeId = req.query.store_id as string || 'default-store';
  const category = req.query.category as string;
  const search = req.query.search as string;
  const isActive = req.query.is_active === 'true';
  const sortBy = req.query.sortBy as string || 'name';
  const sortOrder = req.query.sortOrder as 'asc' | 'desc' || 'asc';

  try {
    const result = await ProductService.getProducts({
      store_id: storeId,
      category,
      search,
      is_active: isActive !== undefined ? isActive : true,
      is_featured: undefined,
      sortBy,
      sortOrder
    });

    res.json({
      success: true,
      message: 'Products retrieved successfully',
      data: result
    });
  } catch (error) {
    logger.error('Error getting products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve products',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * @route   GET /api/v1/public/product/:id
 * @desc    Get single product by ID
 * @access  Public
 */
router.get('/product/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const storeId = req.query.store_id as string || 'default-store';

  try {
    const product = await ProductService.getProductById(id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if product belongs to the store and is active
    if (product.store_id !== storeId || !product.is_active) {
      return res.status(404).json({
        success: false,
        message: 'Product not available'
      });
    }

    res.json({
      success: true,
      message: 'Product retrieved successfully',
      data: product
    });
  } catch (error) {
    logger.error('Error getting product:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve product',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * @route   GET /api/v1/public/product/barcode/:barcode
 * @desc    Get product by barcode
 * @access  Public
 */
router.get('/product/barcode/:barcode', asyncHandler(async (req: Request, res: Response) => {
  const { barcode } = req.params;
  const storeId = req.query.store_id as string || 'default-store';

  try {
    const product = await ProductService.getProductByBarcode(barcode);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if product belongs to the store and is active
    if (product.store_id !== storeId || !product.is_active) {
      return res.status(404).json({
        success: false,
        message: 'Product not available'
      });
    }

    res.json({
      success: true,
      message: 'Product retrieved successfully',
      data: product
    });
  } catch (error) {
    logger.error('Error getting product by barcode:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve product',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * @route   POST /api/v1/public/orders
 * @desc    Create a new customer order
 * @access  Public
 */
router.post('/orders', createOrderValidation, asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  try {
    const orderData = req.body;
    
    // Validate delivery address for delivery orders
    if (orderData.delivery_method === DeliveryMethod.DELIVERY && !orderData.delivery_address) {
      return res.status(400).json({
        success: false,
        message: 'Delivery address is required for delivery orders'
      });
    }

    const order = await CustomerOrderService.createOrder(orderData);
    
    // Generate WhatsApp share link
    const whatsappLink = CustomerOrderService.generateWhatsAppLink(
      order.order_number,
      order.customer_name
    );

    logger.info(`New customer order created: ${order.order_number} for ${order.customer_name}`);

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: {
        order,
        whatsapp_share_link: whatsappLink,
        order_tracking_url: `${req.protocol}://${req.get('host')}/api/v1/public/orders/${order.order_number}/status`
      }
    });
  } catch (error) {
    logger.error('Error creating customer order:', error);
    
    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    
    if (error instanceof Error && error.message.includes('Insufficient stock')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create order',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * @route   GET /api/v1/public/orders/:orderNumber/status
 * @desc    Get order status for tracking
 * @access  Public
 */
router.get('/orders/:orderNumber/status', asyncHandler(async (req: Request, res: Response) => {
  const { orderNumber } = req.params;

  try {
    const order = await CustomerOrderService.getOrderByOrderNumber(orderNumber);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Return limited information for public tracking
    const publicOrderInfo = {
      order_number: order.order_number,
      customer_name: order.customer_name,
      status: order.status,
      total_amount: order.total_amount,
      payment_method: order.payment_method,
      delivery_method: order.delivery_method,
      created_at: order.created_at,
      confirmed_at: order.confirmed_at,
      completed_at: order.completed_at,
      items: order.items.map(item => ({
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price
      }))
    };

    res.json({
      success: true,
      message: 'Order status retrieved successfully',
      data: publicOrderInfo
    });
  } catch (error) {
    logger.error('Error getting order status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve order status',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * @route   GET /api/v1/public/categories
 * @desc    Get available product categories
 * @access  Public
 */
router.get('/categories', asyncHandler(async (req: Request, res: Response) => {
  const storeId = req.query.store_id as string || 'default-store';

  try {
    const categories = await ProductService.getCategories(storeId);
    
    res.json({
      success: true,
      message: 'Categories retrieved successfully',
      data: categories
    });
  } catch (error) {
    logger.error('Error getting categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve categories',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

export default router;
