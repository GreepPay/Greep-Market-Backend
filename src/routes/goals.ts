import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authenticate, robustAuthenticate, optionalAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { GoalService } from '../services/goalService';
import { AuditService } from '../services/auditService';
import { logger } from '../utils/logger';

const router = Router();

/**
 * @route   GET /api/v1/goals
 * @desc    Get user's goals
 * @access  Private
 */
router.get('/', robustAuthenticate, asyncHandler(async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: 'User not authenticated'
      });
    }

    const userId = req.user.id;
    const storeId = req.user.storeId || 'default-store';
    
    const goals = await GoalService.getUserGoals(userId, storeId);
    
    res.json({
      success: true,
      data: goals,
      count: goals.length
    });
  } catch (error) {
    logger.error('Error getting goals:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get goals',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}));

/**
 * @route   GET /api/v1/goals/progress
 * @desc    Get user's goals with progress
 * @access  Private
 */
router.get('/progress', robustAuthenticate, asyncHandler(async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: 'User not authenticated'
      });
    }

    const userId = req.user.id;
    const storeId = req.user.storeId || 'default-store';
    
    const goalsWithProgress = await GoalService.getUserGoalsWithProgress(userId, storeId);
    
    res.json({
      success: true,
      data: goalsWithProgress,
      count: goalsWithProgress.length
    });
  } catch (error) {
    logger.error('Error getting goals with progress:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get goals with progress',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}));

/**
 * @route   GET /api/v1/goals/analytics
 * @desc    Get performance analytics for goals
 * @access  Private
 */
router.get('/analytics', robustAuthenticate, asyncHandler(async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: 'User not authenticated'
      });
    }

    const userId = req.user.id;
    const storeId = req.user.storeId || 'default-store';
    
    const analytics = await GoalService.getPerformanceAnalytics(userId, storeId);
    
    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    logger.error('Error getting goal analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get goal analytics',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}));

/**
 * @route   POST /api/v1/goals
 * @desc    Create a new goal with robust error handling
 * @access  Private
 */
router.post('/', [
  body('goal_type')
    .isIn(['daily', 'monthly', 'weekly', 'yearly'])
    .withMessage('Invalid goal type. Must be one of: daily, monthly, weekly, yearly'),
  body('target_amount')
    .isFloat({ min: 0.01 })
    .withMessage('Target amount must be a positive number greater than 0'),
  body('currency')
    .optional()
    .isIn(['TRY', 'USD', 'NGN', 'EUR'])
    .withMessage('Invalid currency. Must be one of: TRY, USD, NGN, EUR'),
  body('period_start')
    .isISO8601()
    .withMessage('Invalid start date format. Use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)'),
  body('period_end')
    .isISO8601()
    .withMessage('Invalid end date format. Use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)'),
], robustAuthenticate, asyncHandler(async (req: Request, res: Response) => {
  try {
    // Check authentication first
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: 'User not authenticated',
        code: 'AUTH_REQUIRED'
      });
    }

    // Validate request data
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
        code: 'VALIDATION_ERROR'
      });
    }

    const userId = req.user.id;
    const storeId = req.user.storeId || 'default-store';
    
    // Prepare goal data
    const goalData = {
      user_id: userId,
      store_id: storeId,
      goal_type: req.body.goal_type,
      target_amount: parseFloat(req.body.target_amount),
      currency: req.body.currency || 'TRY',
      period_start: new Date(req.body.period_start),
      period_end: new Date(req.body.period_end),
    };

    // Create the goal
    const goal = await GoalService.createGoal(goalData);
    
    // Log the goal creation
    await AuditService.logCreate(
      req,
      'GOAL',
      goal._id,
      `${goal.goal_type} goal - ${goal.target_amount} ${goal.currency}`
    );
    
    res.status(201).json({
      success: true,
      message: 'Goal created successfully',
      data: goal,
      code: 'GOAL_CREATED'
    });
  } catch (error) {
    logger.error('Error creating goal:', error);
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('Invalid goal type')) {
        return res.status(400).json({
          success: false,
          message: 'Invalid goal type',
          error: error.message,
          code: 'INVALID_GOAL_TYPE'
        });
      }
      
      if (error.message.includes('Target amount')) {
        return res.status(400).json({
          success: false,
          message: 'Invalid target amount',
          error: error.message,
          code: 'INVALID_TARGET_AMOUNT'
        });
      }
      
      if (error.message.includes('Period')) {
        return res.status(400).json({
          success: false,
          message: 'Invalid period',
          error: error.message,
          code: 'INVALID_PERIOD'
        });
      }
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to create goal',
      error: error instanceof Error ? error.message : 'Unknown error',
      code: 'INTERNAL_ERROR'
    });
  }
}));

/**
 * @route   PUT /api/v1/goals/:id
 * @desc    Update a goal
 * @access  Private
 */
router.put('/:id', [
  param('id').isMongoId().withMessage('Invalid goal ID'),
  body('target_amount').optional().isFloat({ min: 0.01 }).withMessage('Target amount must be a positive number greater than 0'),
  body('currency').optional().isIn(['TRY', 'USD', 'NGN', 'EUR']).withMessage('Invalid currency'),
  body('period_start').optional().isISO8601().withMessage('Invalid start date format'),
  body('period_end').optional().isISO8601().withMessage('Invalid end date format'),
], robustAuthenticate, asyncHandler(async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: 'User not authenticated',
        code: 'AUTH_REQUIRED'
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
        code: 'VALIDATION_ERROR'
      });
    }

    const goalId = req.params.id;
    const userId = req.user.id;
    
    const updateData: any = {};
    if (req.body.target_amount !== undefined) {
      updateData.target_amount = parseFloat(req.body.target_amount);
    }
    if (req.body.currency !== undefined) {
      updateData.currency = req.body.currency;
    }
    if (req.body.period_start !== undefined) {
      updateData.period_start = new Date(req.body.period_start);
    }
    if (req.body.period_end !== undefined) {
      updateData.period_end = new Date(req.body.period_end);
    }

    // Get the old goal data for audit logging
    const oldGoal = await GoalService.getGoalById(goalId);
    const goal = await GoalService.updateGoal(goalId, userId, updateData);
    
    if (!goal) {
      return res.status(404).json({
        success: false,
        message: 'Goal not found',
        code: 'GOAL_NOT_FOUND'
      });
    }

    // Log the goal update
    await AuditService.logUpdate(
      req,
      'GOAL',
      goalId,
      `${goal.goal_type} goal - ${goal.target_amount} ${goal.currency}`,
      oldGoal,
      goal
    );

    res.json({
      success: true,
      message: 'Goal updated successfully',
      data: goal,
      code: 'GOAL_UPDATED'
    });
  } catch (error) {
    logger.error('Error updating goal:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update goal',
      error: error instanceof Error ? error.message : 'Unknown error',
      code: 'INTERNAL_ERROR'
    });
  }
}));

/**
 * @route   DELETE /api/v1/goals/:id
 * @desc    Delete a goal
 * @access  Private
 */
router.delete('/:id', [
  param('id').isMongoId().withMessage('Invalid goal ID'),
], robustAuthenticate, asyncHandler(async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: 'User not authenticated',
        code: 'AUTH_REQUIRED'
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
        code: 'VALIDATION_ERROR'
      });
    }

    const goalId = req.params.id;
    const userId = req.user.id;
    
    // Get the goal data before deletion for audit logging
    const goal = await GoalService.getGoalById(goalId);
    const deleted = await GoalService.deleteGoal(goalId, userId);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Goal not found',
        code: 'GOAL_NOT_FOUND'
      });
    }

    // Log the goal deletion
    await AuditService.logDelete(
      req,
      'GOAL',
      goalId,
      goal ? `${goal.goal_type} goal - ${goal.target_amount} ${goal.currency}` : 'Unknown Goal',
      goal
    );

    res.json({
      success: true,
      message: 'Goal deleted successfully',
      code: 'GOAL_DELETED'
    });
  } catch (error) {
    logger.error('Error deleting goal:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete goal',
      error: error instanceof Error ? error.message : 'Unknown error',
      code: 'INTERNAL_ERROR'
    });
  }
}));

/**
 * @route   GET /api/v1/goals/:id/progress
 * @desc    Get progress for a specific goal
 * @access  Private
 */
router.get('/:id/progress', [
  param('id').isMongoId().withMessage('Invalid goal ID'),
], robustAuthenticate, asyncHandler(async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: 'User not authenticated',
        code: 'AUTH_REQUIRED'
      });
    }

    const goalId = req.params.id;
    const userId = req.user.id;
    
    const progress = await GoalService.getGoalProgress(goalId, userId);
    
    if (!progress) {
      return res.status(404).json({
        success: false,
        message: 'Goal not found',
        code: 'GOAL_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: progress,
      code: 'PROGRESS_RETRIEVED'
    });
  } catch (error) {
    logger.error('Error getting goal progress:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get goal progress',
      error: error instanceof Error ? error.message : 'Unknown error',
      code: 'INTERNAL_ERROR'
    });
  }
}));

export default router;