import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/app';
import { authService, TokenPayload } from '../services/authService';
import { unauthorizedError, forbiddenError } from './errorHandler';
import { logger } from '../utils/logger';

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        storeId?: string;
      };
    }
  }
}

/**
 * Authentication middleware
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw unauthorizedError('Access token required');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Check if token is blacklisted
    const isBlacklisted = await authService.isTokenBlacklisted(token);
    if (isBlacklisted) {
      throw unauthorizedError('Token has been revoked');
    }

    // Verify token
    const decoded = jwt.verify(token, config.jwt.secret) as TokenPayload;

    // Get user from cache or database
    const user = await authService.getUserById(decoded.userId);
    if (!user) {
      throw unauthorizedError('User not found');
    }

    if (!user.is_active) {
      throw unauthorizedError('Account is deactivated');
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      storeId: user.store_id || undefined,
    };

    next();
  } catch (error) {
    if ((error as any).name === 'JsonWebTokenError') {
      next(unauthorizedError('Invalid token'));
    } else if ((error as any).name === 'TokenExpiredError') {
      next(unauthorizedError('Token expired'));
    } else {
      next(error);
    }
  }
};

/**
 * Authorization middleware - check if user has required role
 */
export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw unauthorizedError('Authentication required');
    }

    if (!roles.includes(req.user.role)) {
      logger.warn(`Access denied for user ${req.user.id} with role ${req.user.role}. Required roles: ${roles.join(', ')}`);
      throw forbiddenError('Insufficient permissions');
    }

    next();
  };
};

/**
 * Store access middleware - check if user has access to the store
 */
export const requireStoreAccess = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    throw unauthorizedError('Authentication required');
  }

  // Admin and owner roles have access to all stores
  if (req.user.role === 'admin' || req.user.role === 'owner') {
    return next();
  }

  // Get store ID from params or body
  const storeId = req.params.storeId || req.body.store_id || req.query.store_id;
  
  if (!storeId) {
    throw forbiddenError('Store ID required');
  }

  if (req.user.storeId !== storeId) {
    logger.warn(`Store access denied for user ${req.user.id} to store ${storeId}`);
    throw forbiddenError('Access denied to this store');
  }

  next();
};

/**
 * Optional authentication middleware
 */
export const optionalAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // Continue without authentication
    }

    const token = authHeader.substring(7);

    // Check if token is blacklisted
    const isBlacklisted = await authService.isTokenBlacklisted(token);
    if (isBlacklisted) {
      return next(); // Continue without authentication
    }

    // Verify token
    const decoded = jwt.verify(token, config.jwt.secret) as TokenPayload;

    // Get user from cache or database
    const user = await authService.getUserById(decoded.userId);
    if (user && user.is_active) {
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        storeId: user.store_id || undefined,
      };
    }

    next();
  } catch (error) {
    // Continue without authentication on any error
    next();
  }
};

/**
 * Permission-based authorization
 */
export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw unauthorizedError('Authentication required');
    }

    const userPermissions = getUserPermissions(req.user.role);
    
    if (!userPermissions.includes(permission) && !userPermissions.includes('*')) {
      logger.warn(`Permission denied for user ${req.user.id} with role ${req.user.role}. Required permission: ${permission}`);
      throw forbiddenError('Insufficient permissions');
    }

    next();
  };
};

/**
 * Get user permissions based on role
 */
const getUserPermissions = (role: string): string[] => {
  const permissions: Record<string, string[]> = {
    admin: ['*'], // All permissions
    owner: [
      'store:read',
      'store:update',
      'users:manage',
      'reports:view',
      'analytics:view',
      'products:manage',
      'inventory:manage',
      'transactions:view',
      'customers:manage',
      'expenses:manage',
    ],
    manager: [
      'products:manage',
      'inventory:manage',
      'transactions:view',
      'reports:view',
      'analytics:view',
      'customers:manage',
      'expenses:view',
    ],
    cashier: [
      'pos:use',
      'transactions:create',
      'inventory:view',
      'products:view',
      'customers:view',
    ],
  };

  return permissions[role] || [];
};

/**
 * Rate limiting middleware for authentication endpoints
 */
export const authRateLimit = (req: Request, res: Response, next: NextFunction): void => {
  // This would be implemented with express-rate-limit
  // For now, just pass through
  next();
};
