import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { NotificationService } from '../services/notificationService';
import { logger } from '../utils/logger';

const router = Router();

// All notification routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/v1/notifications
 * @desc    Get user notifications
 * @access  Private
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const limit = parseInt(req.query.limit as string) || 20;
    const unreadOnly = req.query.unread_only === 'true';

    const notifications = await NotificationService.getUserNotifications(
      userId,
      limit,
      unreadOnly
    );

    const unreadCount = await NotificationService.getUnreadCount(userId);

    res.json({
      success: true,
      data: {
        notifications,
        unread_count: unreadCount,
        total_returned: notifications.length
      }
    });
  } catch (error) {
    logger.error('Error getting notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get notifications',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * @route   GET /api/v1/notifications/unread-count
 * @desc    Get unread notification count
 * @access  Private
 */
router.get('/unread-count', asyncHandler(async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const unreadCount = await NotificationService.getUnreadCount(userId);

    res.json({
      success: true,
      data: {
        unread_count: unreadCount
      }
    });
  } catch (error) {
    logger.error('Error getting unread count:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get unread count',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * @route   PUT /api/v1/notifications/:id/read
 * @desc    Mark notification as read
 * @access  Private
 */
router.put('/:id/read', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;

    const success = await NotificationService.markAsRead(id, userId);

    if (!success) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found or already read'
      });
    }

    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    logger.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * @route   PUT /api/v1/notifications/read-all
 * @desc    Mark all notifications as read
 * @access  Private
 */
router.put('/read-all', asyncHandler(async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const updatedCount = await NotificationService.markAllAsRead(userId);

    res.json({
      success: true,
      message: `Marked ${updatedCount} notifications as read`,
      data: {
        updated_count: updatedCount
      }
    });
  } catch (error) {
    logger.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * @route   POST /api/v1/notifications/test-milestone
 * @desc    Test milestone notification (for development)
 * @access  Private
 */
router.post('/test-milestone', asyncHandler(async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const storeId = (req as any).user.store_id || 'default-store';
    const { milestone_type, milestone_value, goal_percentage } = req.body;

    if (!milestone_type || milestone_value === undefined) {
      return res.status(400).json({
        success: false,
        message: 'milestone_type and milestone_value are required'
      });
    }

    const notification = await NotificationService.createMilestoneNotification(
      userId,
      storeId,
      {
        milestone_type,
        milestone_value,
        goal_percentage
      }
    );

    res.json({
      success: true,
      message: 'Test milestone notification created',
      data: notification
    });
  } catch (error) {
    logger.error('Error creating test milestone notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create test milestone notification',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * @route   POST /api/v1/notifications/test-daily-summary
 * @desc    Test daily summary notification (for development)
 * @access  Private
 */
router.post('/test-daily-summary', asyncHandler(async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const storeId = (req as any).user.store_id || 'default-store';
    const salesData = req.body;

    const notification = await NotificationService.createDailySummaryNotification(
      userId,
      storeId,
      {
        total_sales: salesData.total_sales || 1500,
        transaction_count: salesData.transaction_count || 25,
        top_product: salesData.top_product || 'Popular Product',
        growth_percentage: salesData.growth_percentage || 15,
        daily_goal: salesData.daily_goal || 2000,
        monthly_goal: salesData.monthly_goal || 50000,
        daily_progress: salesData.daily_progress || 75,
        monthly_progress: salesData.monthly_progress || 45
      }
    );

    res.json({
      success: true,
      message: 'Test daily summary notification created',
      data: notification
    });
  } catch (error) {
    logger.error('Error creating test daily summary notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create test daily summary notification',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

export default router;
