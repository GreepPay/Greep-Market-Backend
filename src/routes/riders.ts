import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { RiderService } from '../services/riderService';
import { AuditService } from '../services/auditService';
import { logger } from '../utils/logger';

const router = Router();

// All rider routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/v1/riders
 * @desc    Get all riders
 * @access  Private
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  try {
    const storeId = req.query.store_id as string;
    const riders = await RiderService.getRiders(storeId);
    
    res.json({
      success: true,
      data: riders,
      count: riders.length,
    });
  } catch (error) {
    logger.error('Error getting riders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get riders',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}));

/**
 * @route   GET /api/v1/riders/:id
 * @desc    Get rider by ID
 * @access  Private
 */
router.get('/:id', [
  param('id').isMongoId().withMessage('Invalid rider ID'),
], asyncHandler(async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const riderId = req.params.id;
    const rider = await RiderService.getRiderById(riderId);
    
    if (!rider) {
      return res.status(404).json({
        success: false,
        message: 'Rider not found',
      });
    }

    res.json({
      success: true,
      data: rider,
    });
  } catch (error) {
    logger.error('Error getting rider by ID:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get rider',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}));

/**
 * @route   POST /api/v1/riders
 * @desc    Create a new rider
 * @access  Private
 */
router.post('/', [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('phone')
    .trim()
    .matches(/^[\+]?[0-9][\d]{0,15}$/)
    .withMessage('Invalid phone number format'),
  body('email')
    .optional({ nullable: true, checkFalsy: true })
    .isEmail()
    .normalizeEmail()
    .withMessage('Invalid email format'),
  body('store_id')
    .trim()
    .notEmpty()
    .withMessage('Store ID is required'),
], asyncHandler(async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const riderData = {
      name: req.body.name,
      phone: req.body.phone,
      email: req.body.email,
      store_id: req.body.store_id,
    };

    const rider = await RiderService.createRider(riderData);
    
    // Log the rider creation
    await AuditService.logCreate(
      req,
      'USER', // Using USER as resource type since riders are users
      rider._id,
      rider.name
    );
    
    res.status(201).json({
      success: true,
      message: 'Rider created successfully',
      data: rider,
    });
  } catch (error) {
    logger.error('Error creating rider:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create rider',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}));

/**
 * @route   PUT /api/v1/riders/:id
 * @desc    Update rider
 * @access  Private
 */
router.put('/:id', [
  param('id').isMongoId().withMessage('Invalid rider ID'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('phone')
    .optional()
    .trim()
    .matches(/^[\+]?[0-9][\d]{0,15}$/)
    .withMessage('Invalid phone number format'),
  body('email')
    .optional({ nullable: true, checkFalsy: true })
    .isEmail()
    .normalizeEmail()
    .withMessage('Invalid email format'),
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean'),
], asyncHandler(async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const riderId = req.params.id;
    const updateData = {
      name: req.body.name,
      phone: req.body.phone,
      email: req.body.email,
      is_active: req.body.is_active,
      current_balance: req.body.current_balance,
      total_delivered: req.body.total_delivered,
      total_reconciled: req.body.total_reconciled,
      pending_reconciliation: req.body.pending_reconciliation,
    };

    // Remove undefined values
    Object.keys(updateData).forEach(key => 
      updateData[key as keyof typeof updateData] === undefined && 
      delete updateData[key as keyof typeof updateData]
    );

    // Get the old rider data for audit logging
    const oldRider = await RiderService.getRiderById(riderId);
    const rider = await RiderService.updateRider(riderId, updateData);
    
    if (!rider) {
      return res.status(404).json({
        success: false,
        message: 'Rider not found',
      });
    }

    // Log the rider update
    await AuditService.logUpdate(
      req,
      'USER', // Using USER as resource type since riders are users
      riderId,
      rider.name,
      oldRider,
      rider
    );

    res.json({
      success: true,
      message: 'Rider updated successfully',
      data: rider,
    });
  } catch (error) {
    logger.error('Error updating rider:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update rider',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}));

/**
 * @route   DELETE /api/v1/riders/:id
 * @desc    Delete rider
 * @access  Private
 */
router.delete('/:id', [
  param('id').isMongoId().withMessage('Invalid rider ID'),
], asyncHandler(async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const riderId = req.params.id;
    
    // Get the rider data before deletion for audit logging
    const rider = await RiderService.getRiderById(riderId);
    const deleted = await RiderService.deleteRider(riderId);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Rider not found',
      });
    }

    // Log the rider deletion
    await AuditService.logDelete(
      req,
      'USER', // Using USER as resource type since riders are users
      riderId,
      rider?.name || 'Unknown Rider',
      rider
    );

    res.json({
      success: true,
      message: 'Rider deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting rider:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete rider',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}));

/**
 * @route   POST /api/v1/riders/:id/balance
 * @desc    Update rider balance
 * @access  Private
 */
router.post('/:id/balance', [
  param('id').isMongoId().withMessage('Invalid rider ID'),
  body('amount')
    .isNumeric()
    .withMessage('Amount must be a number'),
  body('type')
    .isIn(['delivery', 'reconciliation'])
    .withMessage('Type must be either "delivery" or "reconciliation"'),
], asyncHandler(async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const riderId = req.params.id;
    const { amount, type } = req.body;

    const rider = await RiderService.updateRiderBalance(riderId, amount, type);
    
    if (!rider) {
      return res.status(404).json({
        success: false,
        message: 'Rider not found',
      });
    }

    res.json({
      success: true,
      message: 'Rider balance updated successfully',
      data: rider,
    });
  } catch (error) {
    logger.error('Error updating rider balance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update rider balance',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}));

/**
 * @route   POST /api/v1/riders/:id/give-cash
 * @desc    Give cash to rider (increase current balance and pending reconciliation)
 * @access  Private
 */
router.post('/:id/give-cash', [
  param('id').isMongoId().withMessage('Invalid rider ID'),
  body('amount')
    .isNumeric()
    .withMessage('Amount must be a number')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be greater than 0'),
], asyncHandler(async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const riderId = req.params.id;
    const { amount } = req.body;

    const rider = await RiderService.giveCashToRider(riderId, amount);
    
    if (!rider) {
      return res.status(404).json({
        success: false,
        message: 'Rider not found',
      });
    }

    res.json({
      success: true,
      message: 'Cash given to rider successfully',
      data: rider,
    });
  } catch (error) {
    logger.error('Error giving cash to rider:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to give cash to rider',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}));

/**
 * @route   POST /api/v1/riders/:id/reconcile
 * @desc    Reconcile rider cash (reduce pending reconciliation)
 * @access  Private
 */
router.post('/:id/reconcile', [
  param('id').isMongoId().withMessage('Invalid rider ID'),
  body('amount')
    .isNumeric()
    .withMessage('Amount must be a number')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be greater than 0'),
], asyncHandler(async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const riderId = req.params.id;
    const { amount } = req.body;

    const rider = await RiderService.reconcileRider(riderId, amount);
    
    if (!rider) {
      return res.status(404).json({
        success: false,
        message: 'Rider not found',
      });
    }

    res.json({
      success: true,
      message: 'Rider reconciled successfully',
      data: rider,
    });
  } catch (error) {
    logger.error('Error reconciling rider:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reconcile rider',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}));

export default router;
