import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = Router();

// All settings routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/v1/settings/notifications
 * @desc    Get notification settings for the authenticated user
 * @access  Private
 */
router.get('/notifications', asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const storeId = (req as any).user.store_id || 'default-store';

  logger.info(`Getting notification settings for user ${userId} in store ${storeId}`);

  // For now, return default settings. In a real app, you'd fetch from database
  const defaultSettings = {
    lowStockAlerts: true,
    dailySalesReport: true,
    newUserRegistrations: false,
    browserNotifications: true,
    soundNotifications: false,
  };

  res.json({
    success: true,
    data: defaultSettings,
  });
}));

/**
 * @route   PUT /api/v1/settings/notifications
 * @desc    Update notification settings for the authenticated user
 * @access  Private
 */
router.put('/notifications', asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const storeId = (req as any).user.store_id || 'default-store';
  const settings = req.body;

  logger.info(`Updating notification settings for user ${userId} in store ${storeId}`, settings);

  // Validate settings
  const allowedSettings = [
    'lowStockAlerts',
    'dailySalesReport', 
    'newUserRegistrations',
    'browserNotifications',
    'soundNotifications'
  ];

  const validatedSettings: any = {};
  for (const key of allowedSettings) {
    if (settings.hasOwnProperty(key) && typeof settings[key] === 'boolean') {
      validatedSettings[key] = settings[key];
    }
  }

  // In a real app, you'd save to database
  // For now, just return success
  logger.info(`Notification settings updated for user ${userId}:`, validatedSettings);

  res.json({
    success: true,
    message: 'Notification settings updated successfully',
    data: validatedSettings,
  });
}));

/**
 * @route   GET /api/v1/settings/security
 * @desc    Get security settings for the authenticated user
 * @access  Private
 */
router.get('/security', asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const storeId = (req as any).user.store_id || 'default-store';

  logger.info(`Getting security settings for user ${userId} in store ${storeId}`);

  // For now, return default settings. In a real app, you'd fetch from database
  const defaultSettings = {
    minPasswordLength: true,
    requireSpecialChars: true,
    passwordExpiration: false,
    autoLogout: true,
    rememberLogin: true,
  };

  res.json({
    success: true,
    data: defaultSettings,
  });
}));

/**
 * @route   PUT /api/v1/settings/security
 * @desc    Update security settings for the authenticated user
 * @access  Private
 */
router.put('/security', asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const storeId = (req as any).user.store_id || 'default-store';
  const settings = req.body;

  logger.info(`Updating security settings for user ${userId} in store ${storeId}`, settings);

  // Validate settings
  const allowedSettings = [
    'minPasswordLength',
    'requireSpecialChars',
    'passwordExpiration',
    'autoLogout',
    'rememberLogin'
  ];

  const validatedSettings: any = {};
  for (const key of allowedSettings) {
    if (settings.hasOwnProperty(key) && typeof settings[key] === 'boolean') {
      validatedSettings[key] = settings[key];
    }
  }

  // In a real app, you'd save to database
  // For now, just return success
  logger.info(`Security settings updated for user ${userId}:`, validatedSettings);

  res.json({
    success: true,
    message: 'Security settings updated successfully',
    data: validatedSettings,
  });
}));

export default router;
