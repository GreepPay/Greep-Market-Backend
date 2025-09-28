import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { AnalyticsService } from '../services/analyticsService';
import { ExpenseService } from '../services/expenseService';
import { logger } from '../utils/logger';
import { getStoreTimezone, debugTimezoneInfo } from '../utils/timezone';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/v1/analytics/dashboard
 * @desc    Get dashboard analytics with filtering support
 * @access  Private
 */
router.get('/dashboard', asyncHandler(async (req: Request, res: Response) => {
  try {
    // Use authenticated user's store_id instead of query parameter
    const storeId = (req as any).user.storeId || 'default-store';
    
    // Extract filter parameters
    const {
      dateRange = '30d',
      paymentMethod,
      orderSource,
      status = 'all', // Changed from 'completed' to 'all' to include pending transactions by default
      startDate,
      endDate
    } = req.query;

    // Debug timezone information for the request
    const timezone = getStoreTimezone(storeId);
    debugTimezoneInfo(startDate as string, timezone);
    
    logger.info('Dashboard request with timezone info:', {
      storeId,
      timezone,
      startDate,
      endDate,
      dateRange,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    // Create filter object
    const filters = {
      dateRange: dateRange as string,
      paymentMethod: paymentMethod as string,
      orderSource: orderSource as string,
      status: status as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined
    };

    const metrics = await AnalyticsService.getDashboardMetrics(storeId, filters);
    
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
    const { period = '30d', start_date, end_date } = req.query;
    // Use authenticated user's store_id instead of query parameter
    const storeId = (req as any).user.storeId || 'default-store';
    
    // If custom date range is provided, use it; otherwise use period
    let salesData;
    if (start_date && end_date) {
      salesData = await AnalyticsService.getSalesAnalyticsByDateRange(
        storeId, 
        new Date(start_date as string), 
        new Date(end_date as string)
      );
    } else {
      salesData = await AnalyticsService.getSalesAnalytics(storeId, period as string);
    }
    
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
    const { period = '30d', limit = 10, start_date, end_date } = req.query;
    // Use authenticated user's store_id instead of query parameter
    const storeId = (req as any).user.storeId || 'default-store';
    
    // If custom date range is provided, use it; otherwise use period
    let productData;
    if (start_date && end_date) {
      productData = await AnalyticsService.getProductAnalyticsByDateRange(
        storeId, 
        new Date(start_date as string), 
        new Date(end_date as string),
        parseInt(limit as string) || 10
      );
    } else {
      productData = await AnalyticsService.getProductAnalytics(storeId);
    }
    
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
 * @route   GET /api/v1/analytics/transactions
 * @desc    Get filtered transactions for dashboard
 * @access  Private
 */
router.get('/transactions', asyncHandler(async (req, res) => {
  try {
    const storeId = (req as any).user.storeId || 'default-store';
    
    // Extract filter parameters
    const {
      dateRange = '30d',
      paymentMethod,
      orderSource,
      status = 'all', // Changed from 'completed' to 'all' to include pending transactions by default
      startDate,
      endDate,
      limit = 50
    } = req.query;

    // Create filter object
    const filters = {
      dateRange: dateRange as string,
      paymentMethod: paymentMethod as string,
      orderSource: orderSource as string,
      status: status as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined
    };

    const transactions = await AnalyticsService.getFilteredTransactions(storeId, filters, parseInt(limit as string) || 50);
    
    res.json({
      success: true,
      data: transactions,
    });
  } catch (error) {
    logger.error('Error getting filtered transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get filtered transactions',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}));

/**
 * @route   GET /api/v1/analytics/expenses
 * @desc    Get expense analytics
 * @access  Private
 */
router.get('/expenses', asyncHandler(async (req, res) => {
  try {
    const storeId = (req as any).user.storeId || 'default-store';
    
    // Extract filter parameters
    const {
      startDate,
      endDate
    } = req.query;

    // Get expense statistics
    const expenseStats = await ExpenseService.getExpenseStats(
      storeId,
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );
    
    res.json({
      success: true,
      data: expenseStats,
    });
  } catch (error) {
    logger.error('Error getting expense analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get expense analytics',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
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
