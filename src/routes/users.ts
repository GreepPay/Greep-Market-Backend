import { Router, Request, Response } from 'express';
import { UserService } from '../services/userService';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { body, param, query } from 'express-validator';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// Validation middleware
const createUserValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('first_name').notEmpty().trim().withMessage('First name is required'),
  body('last_name').notEmpty().trim().withMessage('Last name is required'),
  body('role').isIn(['admin', 'cashier', 'manager', 'owner']).withMessage('Valid role is required'),
  body('phone').optional().isMobilePhone('any').withMessage('Valid phone number is required'),
  body('store_id').optional().isString().withMessage('Store ID must be a string'),
];

const updateUserValidation = [
  param('id').isMongoId().withMessage('Valid user ID is required'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('first_name').optional().notEmpty().trim().withMessage('First name cannot be empty'),
  body('last_name').optional().notEmpty().trim().withMessage('Last name cannot be empty'),
  body('role').optional().isIn(['admin', 'cashier', 'manager', 'owner']).withMessage('Valid role is required'),
  body('phone').optional().isMobilePhone('any').withMessage('Valid phone number is required'),
  body('is_active').optional().isBoolean().withMessage('Active status must be boolean'),
  body('store_id').optional().isString().withMessage('Store ID must be a string'),
];

const updatePasswordValidation = [
  param('id').isMongoId().withMessage('Valid user ID is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
];

const userParamValidation = [
  param('id').isMongoId().withMessage('Valid user ID is required'),
];

const getUsersValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('search').optional().isString().withMessage('Search must be a string'),
  query('role').optional().isIn(['admin', 'cashier', 'manager', 'owner']).withMessage('Valid role is required'),
  query('store_id').optional().isString().withMessage('Store ID must be a string'),
];

/**
 * @route GET /api/v1/users
 * @desc Get all users with pagination and filters
 * @access Admin, Owner
 */
router.get('/', getUsersValidation, validateRequest, async (req: Request, res: Response) => {
  try {
    const { user } = req;
    
    // Check if user has permission to view users
    if (!['admin', 'owner'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin or Owner role required.',
      });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const role = req.query.role as string;
    const store_id = req.query.store_id as string;

    const result = await UserService.getUsers(page, limit, search, role, store_id);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get users',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route GET /api/v1/users/:id
 * @desc Get user by ID
 * @access Admin, Owner
 */
router.get('/:id', userParamValidation, validateRequest, async (req: Request, res: Response) => {
  try {
    const { user } = req;
    const { id } = req.params;
    
    // Check if user has permission to view users
    if (!['admin', 'owner'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin or Owner role required.',
      });
    }

    const userData = await UserService.getUserById(id);
    
    if (!userData) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      data: userData,
    });
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route POST /api/v1/users
 * @desc Create a new user
 * @access Admin, Owner
 */
router.post('/', createUserValidation, validateRequest, async (req: Request, res: Response) => {
  try {
    const { user } = req;
    
    // Check if user has permission to create users
    if (!['admin', 'owner'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin or Owner role required.',
      });
    }

    // Check if current user can manage the target role
    if (!UserService.validateRolePermissions(user.role, req.body.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Cannot create user with higher or equal role.',
      });
    }

    const userData = await UserService.createUser(req.body);

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: userData,
    });
  } catch (error) {
    console.error('Error creating user:', error);
    
    if (error instanceof Error && error.message.includes('already exists')) {
      return res.status(409).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create user',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route PUT /api/v1/users/:id
 * @desc Update user
 * @access Admin, Owner
 */
router.put('/:id', updateUserValidation, validateRequest, async (req: Request, res: Response) => {
  try {
    const { user } = req;
    const { id } = req.params;
    
    // Check if user has permission to update users
    if (!['admin', 'owner'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin or Owner role required.',
      });
    }

    // Get target user to check role
    const targetUser = await UserService.getUserById(id);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if current user can manage the target user
    if (!UserService.canManageUser(user.id, id, user.role, targetUser.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Cannot manage this user.',
      });
    }

    // Check role permissions if role is being updated
    if (req.body.role && !UserService.validateRolePermissions(user.role, req.body.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Cannot assign higher or equal role.',
      });
    }

    const updatedUser = await UserService.updateUser(id, req.body);

    res.json({
      success: true,
      message: 'User updated successfully',
      data: updatedUser,
    });
  } catch (error) {
    console.error('Error updating user:', error);
    
    if (error instanceof Error && error.message.includes('already exists')) {
      return res.status(409).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update user',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route PUT /api/v1/users/:id/password
 * @desc Update user password
 * @access Admin, Owner
 */
router.put('/:id/password', updatePasswordValidation, validateRequest, async (req: Request, res: Response) => {
  try {
    const { user } = req;
    const { id } = req.params;
    const { password } = req.body;
    
    // Check if user has permission to update passwords
    if (!['admin', 'owner'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin or Owner role required.',
      });
    }

    // Get target user to check role
    const targetUser = await UserService.getUserById(id);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if current user can manage the target user
    if (!UserService.canManageUser(user.id, id, user.role, targetUser.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Cannot manage this user.',
      });
    }

    await UserService.updateUserPassword(id, password);

    res.json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update password',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route DELETE /api/v1/users/:id
 * @desc Delete user
 * @access Admin, Owner
 */
router.delete('/:id', userParamValidation, validateRequest, async (req: Request, res: Response) => {
  try {
    const { user } = req;
    const { id } = req.params;
    
    // Check if user has permission to delete users
    if (!['admin', 'owner'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin or Owner role required.',
      });
    }

    // Prevent users from deleting themselves
    if (user.id === id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account',
      });
    }

    // Get target user to check role
    const targetUser = await UserService.getUserById(id);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if current user can manage the target user
    if (!UserService.canManageUser(user.id, id, user.role, targetUser.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Cannot manage this user.',
      });
    }

    await UserService.deleteUser(id);

    res.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route PATCH /api/v1/users/:id/toggle-status
 * @desc Toggle user active status
 * @access Admin, Owner
 */
router.patch('/:id/toggle-status', userParamValidation, validateRequest, async (req: Request, res: Response) => {
  try {
    const { user } = req;
    const { id } = req.params;
    
    // Check if user has permission to toggle user status
    if (!['admin', 'owner'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin or Owner role required.',
      });
    }

    // Prevent users from deactivating themselves
    if (user.id === id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot deactivate your own account',
      });
    }

    // Get target user to check role
    const targetUser = await UserService.getUserById(id);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if current user can manage the target user
    if (!UserService.canManageUser(user.id, id, user.role, targetUser.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Cannot manage this user.',
      });
    }

    const updatedUser = await UserService.toggleUserStatus(id);

    res.json({
      success: true,
      message: `User ${updatedUser.is_active ? 'activated' : 'deactivated'} successfully`,
      data: updatedUser,
    });
  } catch (error) {
    console.error('Error toggling user status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle user status',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route GET /api/v1/users/role/:role
 * @desc Get users by role
 * @access Admin, Owner
 */
router.get('/role/:role', async (req: Request, res: Response) => {
  try {
    const { user } = req;
    const { role } = req.params;
    
    // Check if user has permission to view users
    if (!['admin', 'owner'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin or Owner role required.',
      });
    }

    if (!['admin', 'cashier', 'manager', 'owner'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role specified',
      });
    }

    const users = await UserService.getUsersByRole(role);

    res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error('Error getting users by role:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get users by role',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;