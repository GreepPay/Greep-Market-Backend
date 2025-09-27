import { Router, Request, Response } from 'express';
import { param, validationResult } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { AutoCompleteService } from '../services/autoCompleteService';
import { CronService } from '../services/cronService';
import { logger } from '../utils/logger';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/v1/auto-complete/trigger
 * @desc    Manually trigger auto-complete process
 * @access  Private (Admin/Owner/Manager)
 */
router.post('/trigger', authorize('admin', 'owner', 'manager'), asyncHandler(async (req: Request, res: Response) => {
  try {
    const result = await CronService.triggerAutoComplete();
    
    res.json({
      success: true,
      message: 'Auto-complete process triggered successfully',
      data: result
    });
  } catch (error) {
    logger.error('Error triggering auto-complete:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to trigger auto-complete process',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * @route   GET /api/v1/auto-complete/stats
 * @desc    Get pending transaction statistics
 * @access  Private (Admin/Owner/Manager)
 */
router.get('/stats', authorize('admin', 'owner', 'manager'), asyncHandler(async (req: Request, res: Response) => {
  try {
    const stats = await AutoCompleteService.getPendingTransactionStats();
    
    res.json({
      success: true,
      message: 'Pending transaction statistics retrieved successfully',
      data: stats
    });
  } catch (error) {
    logger.error('Error getting pending transaction stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve pending transaction statistics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * @route   POST /api/v1/auto-complete/complete/:id
 * @desc    Manually complete a specific transaction
 * @access  Private (Admin/Owner/Manager)
 */
router.post('/complete/:id', authorize('admin', 'owner', 'manager'), [
  param('id').isMongoId().withMessage('Valid transaction ID is required')
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
    const success = await AutoCompleteService.completeTransaction(id);
    
    if (success) {
      res.json({
        success: true,
        message: 'Transaction completed successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }
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
 * @route   GET /api/v1/auto-complete/cron-status
 * @desc    Get cron job status
 * @access  Private (Admin/Owner)
 */
router.get('/cron-status', authorize('admin', 'owner'), asyncHandler(async (req: Request, res: Response) => {
  try {
    const status = CronService.getJobStatus();
    
    res.json({
      success: true,
      message: 'Cron job status retrieved successfully',
      data: status
    });
  } catch (error) {
    logger.error('Error getting cron job status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve cron job status',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

export default router;
