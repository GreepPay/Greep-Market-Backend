import { Request, Response, NextFunction } from 'express';
// import { monitoringService } from '../services/monitoringService';
import { logger } from '../utils/logger';

/**
 * Request monitoring middleware
 */
export const requestMonitoring = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();

  // Override res.end to capture response time
  const originalEnd = res.end.bind(res);
  res.end = function(chunk?: any, encoding?: any, cb?: any): any {
    const responseTime = Date.now() - startTime;
    const isError = res.statusCode >= 400;

    // Record metrics (temporarily disabled)
    // monitoringService.recordRequest(responseTime, isError);

    // Log request
    logger.info({
      method: req.method,
      url: req.url,
      status: res.statusCode,
      responseTime,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    });

    // Call original end
    return originalEnd(chunk, encoding, cb);
  };

  next();
};

/**
 * Performance monitoring middleware
 */
export const performanceMonitoring = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = process.hrtime.bigint();

  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds

    // Log slow requests
    if (duration > 1000) {
      logger.warn({
        message: 'Slow request detected',
        method: req.method,
        url: req.url,
        duration: `${duration.toFixed(2)}ms`,
        status: res.statusCode,
      });
    }
  });

  next();
};

/**
 * Error monitoring middleware
 */
export const errorMonitoring = (error: Error, req: Request, res: Response, next: NextFunction): void => {
  // Log error details
  logger.error({
    message: 'Request error',
    error: error.message,
    stack: error.stack,
    method: req.method,
    url: req.url,
    body: req.body,
    query: req.query,
    params: req.params,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
  });

  next(error);
};
