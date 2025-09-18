import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { InventoryService } from '../services/inventoryService';

const router = Router();

// All inventory routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/v1/inventory
 * @desc    Get all inventory items
 * @access  Private
 */
router.get('/', asyncHandler(async (req, res) => {
  // Mock response for now
  res.json({
    success: true,
    data: [],
    message: 'Inventory endpoint - to be implemented'
  });
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
 * @route   POST /api/v1/inventory/:productId/adjust
 * @desc    Adjust inventory
 * @access  Private
 */
router.post('/:productId/adjust', asyncHandler(async (req, res) => {
  // Mock response for now
  res.json({
    success: true,
    message: 'Inventory adjustment endpoint - to be implemented'
  });
}));

export default router;
