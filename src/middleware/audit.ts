import { Request, Response, NextFunction } from 'express';
import { AuditService } from '../services/auditService';
import { logger } from '../utils/logger';

/**
 * Middleware to log all requests for audit purposes
 */
export const auditMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Skip logging for certain paths
  const skipPaths = ['/health', '/metrics', '/favicon.ico', '/static', '/assets'];
  if (skipPaths.some(path => req.path.includes(path))) {
    return next();
  }

  // Only log significant requests (not GET requests to static content)
  const shouldLog = req.method !== 'GET' || 
                   req.path.includes('/api/') || 
                   req.path.includes('/auth/') ||
                   req.path.includes('/admin/');

  if (shouldLog) {
    const user = (req as any).user;
    const userInfo = user ? {
      user_id: user.id || user._id,
      user_email: user.email,
      user_role: user.role,
    } : { user_id: 'anonymous', user_email: 'anonymous', user_role: 'guest' };

    // Use debug level instead of info to reduce noise
    logger.debug(`${req.method} ${req.path}`, {
      method: req.method,
      path: req.path,
      user: userInfo,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  next();
};

/**
 * Middleware to audit specific resource operations
 */
export const auditResource = (
  resource_type: string,
  getResourceId: (req: Request) => string,
  getResourceName: (req: Request, res: Response) => string
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send;
    let responseBody: any;

    res.send = function(body: any) {
      responseBody = body;
      return originalSend.call(this, body);
    };

    res.on('finish', async () => {
      try {
        // Only log successful operations
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const user = (req as any).user;
          if (!user) return; // Skip if user not authenticated

          const resource_id = getResourceId(req);
          const resource_name = getResourceName(req, res);
          
          let action: 'CREATE' | 'UPDATE' | 'DELETE' | 'EXPORT' | 'IMPORT';
          
          switch (req.method) {
            case 'POST':
              action = 'CREATE';
              break;
            case 'PUT':
            case 'PATCH':
              action = 'UPDATE';
              break;
            case 'DELETE':
              action = 'DELETE';
              break;
            default:
              return; // Skip other methods
          }

          // Handle special cases
          if (req.path.includes('/export')) {
            action = 'EXPORT';
          } else if (req.path.includes('/import')) {
            action = 'IMPORT';
          }

          await AuditService.createAuditLog({
            user_id: user.id || user._id,
            user_email: user.email,
            user_role: user.role,
            action,
            resource_type: resource_type as any,
            resource_id,
            resource_name,
            metadata: {
              ip_address: req.ip,
              user_agent: req.headers['user-agent'],
              store_id: user.store_id,
              additional_info: {
                endpoint: req.path,
                method: req.method,
                status_code: res.statusCode,
              },
            },
          });
        }
      } catch (error) {
        logger.error('Error in audit middleware:', error);
        // Don't throw error to avoid breaking the response
      }
    });

    next();
  };
};

/**
 * Specific audit middleware for products
 */
export const auditProducts = auditResource(
  'PRODUCT',
  (req: Request) => {
    // Try to get ID from params, body, or response
    return req.params.id || req.body._id || req.body.id || 'unknown';
  },
  (req: Request, res: Response) => {
    try {
      const responseBody = JSON.parse(res.getHeader('Content-Type')?.toString() || '{}');
      if (responseBody?.data?.name) {
        return responseBody.data.name;
      }
    } catch (error) {
      // Ignore parsing errors
    }
    
    return req.body.name || req.params.id || 'Product';
  }
);

/**
 * Specific audit middleware for transactions
 */
export const auditTransactions = auditResource(
  'TRANSACTION',
  (req: Request) => {
    return req.params.id || req.body._id || req.body.id || 'unknown';
  },
  (req: Request, res: Response) => {
    try {
      const responseBody = JSON.parse(res.getHeader('Content-Type')?.toString() || '{}');
      if (responseBody?.data?._id) {
        return `Transaction ${responseBody.data._id}`;
      }
    } catch (error) {
      // Ignore parsing errors
    }
    
    return `Transaction ${req.params.id || 'new'}`;
  }
);

/**
 * Specific audit middleware for expenses
 */
export const auditExpenses = auditResource(
  'EXPENSE',
  (req: Request) => {
    return req.params.id || req.body._id || req.body.id || 'unknown';
  },
  (req: Request, res: Response) => {
    return req.body.product_name || req.body.description || `Expense ${req.params.id || 'new'}`;
  }
);

/**
 * Specific audit middleware for users
 */
export const auditUsers = auditResource(
  'USER',
  (req: Request) => {
    return req.params.id || req.body._id || req.body.id || 'unknown';
  },
  (req: Request, res: Response) => {
    return req.body.email || req.body.name || `User ${req.params.id || 'new'}`;
  }
);

/**
 * Middleware to audit authentication events
 */
export const auditAuth = async (req: Request, res: Response, next: NextFunction) => {
  const originalSend = res.send;
  let responseBody: any;

  res.send = function(body: any) {
    responseBody = body;
    return originalSend.call(this, body);
  };

  res.on('finish', async () => {
    try {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const isLogin = req.path.includes('/login');
        const isLogout = req.path.includes('/logout');
        
        if (isLogin || isLogout) {
          const action = isLogin ? 'LOGIN' : 'LOGOUT';
          
          // Try to extract user info from response
          let user_id = 'unknown';
          let user_email = 'unknown';
          let user_role = 'unknown';
          let store_id: string | undefined;

          try {
            const parsedBody = typeof responseBody === 'string' ? JSON.parse(responseBody) : responseBody;
            if (parsedBody?.data?.user) {
              const user = parsedBody.data.user;
              user_id = user.id || user._id;
              user_email = user.email;
              user_role = user.role;
              store_id = user.store_id;
            }
          } catch (error) {
            // Ignore parsing errors
          }

          await AuditService.logAuth(
            req,
            action,
            user_id,
            user_email,
            user_role,
            store_id
          );
        }
      }
    } catch (error) {
      logger.error('Error in auth audit middleware:', error);
    }
  });

  next();
};
