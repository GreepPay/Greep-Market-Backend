import { Request, Response, NextFunction } from 'express';
import { getConnectionStatus, isConnectionHealthy } from '../config/database';
import { logger } from '../utils/logger';

/**
 * Middleware to check database health before processing requests
 * This prevents the "Client must be connected before running operations" error
 */
export const databaseHealthCheck = (req: Request, res: Response, next: NextFunction): void => {
  // Skip health check for health endpoint and static files
  if (req.path === '/health' || req.path === '/favicon.ico' || req.path.startsWith('/static')) {
    return next();
  }

  if (!isConnectionHealthy()) {
    logger.error('Database connection unhealthy, rejecting request', {
      path: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      dbStatus: getConnectionStatus()
    });

    res.status(503).json({
      success: false,
      error: {
        message: 'Database connection unavailable',
        code: 'DATABASE_UNAVAILABLE'
      },
      timestamp: new Date().toISOString(),
      path: req.path,
    });
    return;
  }

  next();
};

/**
 * Enhanced database health check for critical operations
 */
export const criticalDatabaseHealthCheck = (req: Request, res: Response, next: NextFunction): void => {
  const dbStatus = getConnectionStatus();
  
  if (!dbStatus.isHealthy) {
    logger.error('Critical database health check failed', {
      path: req.path,
      method: req.method,
      ip: req.ip,
      dbStatus
    });

    res.status(503).json({
      success: false,
      error: {
        message: 'Database connection is not healthy',
        code: 'DATABASE_UNHEALTHY',
        details: {
          status: dbStatus.status,
          readyState: dbStatus.readyState,
          connectionAttempts: dbStatus.connectionAttempts
        }
      },
      timestamp: new Date().toISOString(),
      path: req.path,
    });
    return;
  }

  next();
};

/**
 * Database health check for authentication endpoints
 */
export const authDatabaseHealthCheck = (req: Request, res: Response, next: NextFunction): void => {
  // For auth endpoints, we need a healthy database connection
  if (!isConnectionHealthy()) {
    logger.error('Database unhealthy for auth operation', {
      path: req.path,
      method: req.method,
      ip: req.ip,
      dbStatus: getConnectionStatus()
    });

    res.status(503).json({
      success: false,
      error: {
        message: 'Authentication service temporarily unavailable',
        code: 'AUTH_SERVICE_UNAVAILABLE'
      },
      timestamp: new Date().toISOString(),
      path: req.path,
    });
    return;
  }

  next();
};


