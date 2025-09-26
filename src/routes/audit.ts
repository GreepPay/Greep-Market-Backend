import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { AuditService } from '../services/auditService';
import { logger } from '../utils/logger';

const router = Router();

// All audit routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/v1/audit/logs
 * @desc    Get audit logs with filtering and pagination
 * @access  Private (Admin/Manager only)
 */
router.get('/logs', asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  
  // Allow cashiers to view audit logs for their store only
  if (!['admin', 'manager', 'cashier'].includes(user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin, Manager, or Cashier role required.',
    });
  }

  const {
    page = 1,
    limit = 50,
    user_id,
    resource_type,
    action,
    start_date,
    end_date,
    user_role,
  } = req.query;

  const options = {
    page: parseInt(page as string) || 1,
    limit: Math.min(parseInt(limit as string) || 50, 100), // Max 100 per page
    user_id: user_id as string,
    resource_type: resource_type as string,
    action: action as string,
    store_id: user.store_id,
    start_date: start_date ? new Date(start_date as string) : undefined,
    end_date: end_date ? new Date(end_date as string) : undefined,
    user_role: user_role as string,
  };

  // Apply role-based filtering for managers
  if (user.role === 'manager') {
    // Managers can only see logs for managers and cashiers
    if (user_role && typeof user_role === 'string' && !['manager', 'cashier'].includes(user_role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Managers can only view logs for managers and cashiers.',
      });
    }
    // If no role specified, default to manager and cashier roles
    if (!user_role) {
      options.user_role = 'manager,cashier';
    }
  }

  const result = await AuditService.getAuditLogs(options);

  res.json({
    success: true,
    data: result,
  });
}));

/**
 * @route   GET /api/v1/audit/resource/:resource_type/:resource_id
 * @desc    Get audit trail for a specific resource
 * @access  Private
 */
router.get('/resource/:resource_type/:resource_id', asyncHandler(async (req: Request, res: Response) => {
  const { resource_type, resource_id } = req.params;
  const user = (req as any).user;

  // Only admin and manager can view audit trails
  if (!['admin', 'manager'].includes(user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin or Manager role required.',
    });
  }

  const auditTrail = await AuditService.getResourceAuditTrail(resource_type, resource_id);

  res.json({
    success: true,
    data: auditTrail,
  });
}));

/**
 * @route   GET /api/v1/audit/user/:user_id
 * @desc    Get user activity summary
 * @access  Private (Admin/Manager only)
 */
router.get('/user/:user_id', asyncHandler(async (req: Request, res: Response) => {
  const { user_id } = req.params;
  const user = (req as any).user;
  const { days = 30 } = req.query;

  // Only admin and manager can view user activity
  if (!['admin', 'manager'].includes(user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin or Manager role required.',
    });
  }

  const activitySummary = await AuditService.getUserActivitySummary(
    user_id,
    parseInt(days as string) || 30
  );

  res.json({
    success: true,
    data: activitySummary,
  });
}));

/**
 * @route   GET /api/v1/audit/my-activity
 * @desc    Get current user's activity summary
 * @access  Private
 */
router.get('/my-activity', asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { days = 30 } = req.query;

  const activitySummary = await AuditService.getUserActivitySummary(
    user.id || user._id,
    parseInt(days as string) || 30
  );

  res.json({
    success: true,
    data: activitySummary,
  });
}));

/**
 * @route   GET /api/v1/audit/logs/export
 * @desc    Export audit logs to CSV
 * @access  Private (Admin/Manager only)
 */
router.get('/logs/export', asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  
  // Allow cashiers to export audit logs for their store
  if (!['admin', 'manager', 'cashier'].includes(user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin, Manager, or Cashier role required.',
    });
  }

  const {
    page = 1,
    limit = 1000, // Larger limit for export
    user_id,
    resource_type,
    action,
    start_date,
    end_date,
  } = req.query;

  const options = {
    page: parseInt(page as string) || 1,
    limit: Math.min(parseInt(limit as string) || 1000, 5000), // Max 5000 for export
    user_id: user_id as string,
    resource_type: resource_type as string,
    action: action as string,
    store_id: user.store_id,
    start_date: start_date ? new Date(start_date as string) : undefined,
    end_date: end_date ? new Date(end_date as string) : undefined,
  };

  const result = await AuditService.getAuditLogs(options);

  // Generate CSV content
  const csvHeaders = [
    'Timestamp',
    'User Email',
    'User Role',
    'Action',
    'Resource Type',
    'Resource Name',
    'Resource ID',
    'IP Address',
    'User Agent',
    'Changes'
  ];

  const csvRows = result.logs.map(log => [
    new Date(log.created_at).toISOString(),
    log.user_email,
    log.user_role,
    log.action,
    log.resource_type,
    log.resource_name,
    log.resource_id,
    log.metadata?.ip_address || '',
    log.metadata?.user_agent || '',
    log.changes ? JSON.stringify(log.changes) : ''
  ]);

  const csvContent = [
    csvHeaders.join(','),
    ...csvRows.map(row => row.map(field => `"${field}"`).join(','))
  ].join('\n');

  // Set headers for CSV download
  const filename = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csvContent);
}));

/**
 * @route   GET /api/v1/audit/stats
 * @desc    Get audit statistics
 * @access  Private (Admin only)
 */
router.get('/stats', asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;

  // Allow admin, manager, and cashier to view audit statistics
  if (!['admin', 'manager', 'cashier'].includes(user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin, Manager, or Cashier role required.',
    });
  }

  const { start_date, end_date } = req.query;
  const store_id = user.store_id;

  // Get audit logs for the period
  const auditLogs = await AuditService.getAuditLogs({
    store_id,
    start_date: start_date ? new Date(start_date as string) : undefined,
    end_date: end_date ? new Date(end_date as string) : undefined,
    limit: 10000, // Get all logs for stats
  });

  // Calculate statistics
  const stats = {
    total_actions: auditLogs.total,
    actions_by_type: auditLogs.logs.reduce((acc, log) => {
      acc[log.action] = (acc[log.action] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    actions_by_resource: auditLogs.logs.reduce((acc, log) => {
      acc[log.resource_type] = (acc[log.resource_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    actions_by_user: auditLogs.logs.reduce((acc, log) => {
      acc[log.user_email] = (acc[log.user_email] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    most_active_users: Object.entries(
      auditLogs.logs.reduce((acc, log) => {
        acc[log.user_email] = (acc[log.user_email] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    )
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([email, count]) => ({ email, count })),
    recent_activity: auditLogs.logs.slice(0, 20),
  };

  res.json({
    success: true,
    data: stats,
  });
}));

export default router;
