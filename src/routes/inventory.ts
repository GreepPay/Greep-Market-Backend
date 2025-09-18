import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { InventoryService } from '../services/inventoryService';
import { Product } from '../models/Product';

const router = Router();

// All inventory routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/v1/inventory
 * @desc    Get inventory summary
 * @access  Private
 */
router.get('/', asyncHandler(async (req, res) => {
  try {
    const storeId = req.query.store_id as string;
    const summary = await InventoryService.getInventorySummary(storeId);
    
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error getting inventory summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get inventory summary',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * @route   GET /api/v1/inventory/low-stock
 * @desc    Get low stock items
 * @access  Private
 */
router.get('/low-stock', asyncHandler(async (req: Request, res: Response) => {
  try {
    const storeId = req.query.store_id as string;
    const lowStockItems = await InventoryService.getLowStockItems(storeId);
    
    res.json({
      success: true,
      data: lowStockItems,
    });
  } catch (error) {
    console.error('Error getting low stock items:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get low stock items',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}));

/**
 * @route   GET /api/v1/inventory/out-of-stock
 * @desc    Get out of stock items
 * @access  Private
 */
router.get('/out-of-stock', asyncHandler(async (req: Request, res: Response) => {
  try {
    const storeId = req.query.store_id as string;
    const outOfStockItems = await InventoryService.getOutOfStockItems(storeId);
    
    res.json({
      success: true,
      data: outOfStockItems,
    });
  } catch (error) {
    console.error('Error getting out of stock items:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get out of stock items',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}));

/**
 * @route   GET /api/v1/inventory/alerts
 * @desc    Get inventory alerts
 * @access  Private
 */
router.get('/alerts', asyncHandler(async (req: Request, res: Response) => {
  try {
    const storeId = req.query.store_id as string;
    const alerts = await InventoryService.getInventoryAlerts(storeId);
    
    res.json({
      success: true,
      data: alerts,
    });
  } catch (error) {
    console.error('Error getting inventory alerts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get inventory alerts',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}));

/**
 * @route   POST /api/v1/inventory/:productId/adjust
 * @desc    Adjust inventory
 * @access  Private
 */
router.post('/:productId/adjust', asyncHandler(async (req, res) => {
  try {
    const { productId } = req.params;
    const { adjustment_type, quantity, reason, notes } = req.body;
    
    // Validate required fields
    if (!adjustment_type || quantity === undefined || quantity === null) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: adjustment_type, quantity'
      });
    }

    if (!['add', 'subtract', 'set'].includes(adjustment_type)) {
      return res.status(400).json({
        success: false,
        message: 'adjustment_type must be: add, subtract, or set'
      });
    }

    if (typeof quantity !== 'number' || quantity < 0) {
      return res.status(400).json({
        success: false,
        message: 'quantity must be a non-negative number'
      });
    }

    // Get current product
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    let newStock = product.stock_quantity;
    
    // Calculate new stock based on adjustment type
    switch (adjustment_type) {
      case 'add':
        newStock = product.stock_quantity + quantity;
        break;
      case 'subtract':
        newStock = Math.max(0, product.stock_quantity - quantity);
        break;
      case 'set':
        newStock = quantity;
        break;
    }

    // Update product stock
    await InventoryService.updateProductStock(productId, newStock);

    // Log the adjustment
    console.log(`Inventory adjusted for product ${product.name}: ${adjustment_type} ${quantity}, new stock: ${newStock}, reason: ${reason || 'No reason provided'}`);

    res.json({
      success: true,
      message: 'Inventory adjusted successfully',
      data: {
        product_id: productId,
        product_name: product.name,
        old_stock: product.stock_quantity,
        new_stock: newStock,
        adjustment_type,
        adjustment_quantity: quantity,
        reason: reason || 'No reason provided',
        notes: notes || ''
      }
    });
  } catch (error) {
    console.error('Error adjusting inventory:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to adjust inventory',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

export default router;
