import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { AnalyticsService } from '../services/analyticsService';
import { logger } from '../utils/logger';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/v1/analytics/dashboard
 * @desc    Get dashboard analytics
 * @access  Private
 */
router.get('/dashboard', asyncHandler(async (req: Request, res: Response) => {
  try {
    // Use authenticated user's store_id instead of query parameter
    const storeId = (req as any).user.storeId || 'default-store';
    const metrics = await AnalyticsService.getDashboardMetrics(storeId);
    
    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    logger.error('Error getting dashboard metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get dashboard metrics',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}));

/**
 * @route   GET /api/v1/analytics/sales
 * @desc    Get sales analytics
 * @access  Private
 */
router.get('/sales', asyncHandler(async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    // Use authenticated user's store_id instead of query parameter
    const storeId = (req as any).user.storeId || 'default-store';
    
    const salesData = await AnalyticsService.getSalesAnalytics(storeId, period as string);
    
    res.json({
      success: true,
      data: salesData,
    });
  } catch (error) {
    logger.error('Error getting sales analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get sales analytics',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}));

/**
 * @route   GET /api/v1/analytics/products
 * @desc    Get product performance analytics
 * @access  Private
 */
router.get('/products', asyncHandler(async (req, res) => {
  try {
    const { period = '30d', limit = 10 } = req.query;
    // Use authenticated user's store_id instead of query parameter
    const storeId = (req as any).user.storeId || 'default-store';
    
    const productData = await AnalyticsService.getProductAnalytics(storeId);
    
    res.json({
      success: true,
      data: productData,
    });
  } catch (error) {
    logger.error('Error getting product analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get product analytics',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}));

/**
 * @route   GET /api/v1/analytics/inventory
 * @desc    Get inventory analytics
 * @access  Private
 */
router.get('/inventory', asyncHandler(async (req, res) => {
  // TODO: Implement inventory analytics
  res.json({
    success: true,
    message: 'Inventory analytics endpoint - to be implemented',
    data: null,
  });
}));

/**
 * @route   GET /api/v1/analytics/customers
 * @desc    Get customer analytics
 * @access  Private
 */
router.get('/customers', asyncHandler(async (req, res) => {
  // TODO: Implement customer analytics
  res.json({
    success: true,
    message: 'Customer analytics endpoint - to be implemented',
    data: null,
  });
}));

/**
 * @route   GET /api/v1/analytics/reports
 * @desc    Get various reports
 * @access  Private (admin/owner/manager only)
 */
router.get('/reports', authorize('admin', 'owner', 'manager'), asyncHandler(async (req, res) => {
  // TODO: Implement reports
  res.json({
    success: true,
    message: 'Reports endpoint - to be implemented',
    data: null,
  });
}));

export default router;
