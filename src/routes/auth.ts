import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { authService } from '../services/authService';
import { AuditService } from '../services/auditService';
import { authenticate } from '../middleware/auth';
import { asyncHandler, validationError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = Router();

// Validation rules
const registerValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  body('role')
    .isIn(['admin', 'cashier', 'manager', 'owner'])
    .withMessage('Valid role is required'),
  body('first_name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('First name must be between 2 and 100 characters'),
  body('last_name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Last name must be between 2 and 100 characters'),
  body('phone')
    .optional()
    .isMobilePhone('tr-TR')
    .withMessage('Valid phone number is required'),
  body('store_id')
    .optional()
    .isUUID()
    .withMessage('Valid store ID is required'),
];

const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
];

const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
];

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user
 * @access  Public (in production, this should be restricted)
 */
router.post('/register', registerValidation, asyncHandler(async (req, res) => {
  // Check validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw validationError(errors.array().map(err => err.msg).join(', '));
  }

  const userData = req.body;
  const result = await authService.register(userData);

  logger.info(`New user registered: ${userData.email}`);

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      user: {
        id: result.user.id,
        email: result.user.email,
        role: result.user.role,
        store_id: result.user.store_id,
        first_name: result.user.first_name,
        last_name: result.user.last_name,
        phone: result.user.phone,
        is_active: result.user.is_active,
        created_at: result.user.created_at,
      },
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
    },
  });
}));

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', loginValidation, asyncHandler(async (req, res) => {
  // Check validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw validationError(errors.array().map(err => err.msg).join(', '));
  }

  const { email, password } = req.body;
  const result = await authService.login({ email, password });

  logger.info(`User logged in: ${email}`);

  // Log the login action
  await AuditService.logAuth(
    req,
    'LOGIN',
    result.user.id,
    result.user.email,
    result.user.role,
    result.user.store_id
  );

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: result.user.id,
        email: result.user.email,
        role: result.user.role,
        store_id: result.user.store_id,
        first_name: result.user.first_name,
        last_name: result.user.last_name,
        phone: result.user.phone,
        is_active: result.user.is_active,
        last_login: result.user.last_login,
      },
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
    },
  });
}));

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post('/refresh', [
  body('refreshToken')
    .notEmpty()
    .withMessage('Refresh token is required'),
], asyncHandler(async (req, res) => {
  // Check validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw validationError(errors.array().map(err => err.msg).join(', '));
  }

  const { refreshToken } = req.body;
  const result = await authService.refreshToken(refreshToken);

  res.json({
    success: true,
    message: 'Token refreshed successfully',
    data: {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
    },
  });
}));

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', authenticate, asyncHandler(async (req, res) => {
  const token = req.headers.authorization?.substring(7);
  const success = await authService.logout(req.user!.id, token || '');

  if (success) {
    // Log the logout action
    await AuditService.logAuth(
      req,
      'LOGOUT',
      req.user!.id,
      req.user!.email,
      req.user!.role,
      req.user!.storeId
    );

    res.json({
      success: true,
      message: 'Logout successful',
    });
  } else {
    res.status(500).json({
      success: false,
      message: 'Logout failed',
    });
  }
}));

/**
 * @route   POST /api/v1/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.post('/change-password', authenticate, changePasswordValidation, asyncHandler(async (req, res) => {
  // Check validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw validationError(errors.array().map(err => err.msg).join(', '));
  }

  const { currentPassword, newPassword } = req.body;
  const success = await authService.changePassword(req.user!.id, currentPassword, newPassword);

  if (success) {
    logger.info(`Password changed for user: ${req.user!.id}`);
    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } else {
    res.status(500).json({
      success: false,
      message: 'Password change failed',
    });
  }
}));

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const user = await authService.getUserById(req.user!.id);

  if (!user) {
    throw validationError('User not found');
  }

  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        store_id: user.store_id,
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone,
        is_active: user.is_active,
        last_login: user.last_login,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    },
  });
}));

/**
 * @route   POST /api/v1/auth/verify-token
 * @desc    Verify if token is valid
 * @access  Private
 */
router.post('/verify-token', authenticate, asyncHandler(async (req, res) => {
  res.json({
    success: true,
    message: 'Token is valid',
    data: {
      user: {
        id: req.user!.id,
        email: req.user!.email,
        role: req.user!.role,
        storeId: req.user!.storeId,
      },
    },
  });
}));

export default router;
