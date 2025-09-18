import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { createError, validationError } from './errorHandler';

/**
 * Middleware to validate request data using express-validator
 */
export const validateRequest = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.type === 'field' ? error.path : 'unknown',
      message: error.msg,
      value: error.type === 'field' ? error.value : undefined
    }));

    const error = validationError('Validation failed');
    return next(error);
  }

  next();
};

/**
 * Middleware to validate MongoDB ObjectId
 */
export const validateObjectId = (paramName: string = 'id') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const id = req.params[paramName];
    
    if (!id) {
      const error = createError(`${paramName} parameter is required`, 400);
      return next(error);
    }

    // MongoDB ObjectId pattern
    const objectIdPattern = /^[0-9a-fA-F]{24}$/;
    
    if (!objectIdPattern.test(id)) {
      const error = createError(`Invalid ${paramName} format`, 400);
      return next(error);
    }

    next();
  };
};

/**
 * Middleware to validate pagination parameters
 */
export const validatePagination = (req: Request, res: Response, next: NextFunction): void => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;

  if (page < 1) {
    const error = createError('Page must be a positive integer', 400);
    return next(error);
  }

  if (limit < 1 || limit > 100) {
    const error = createError('Limit must be between 1 and 100', 400);
    return next(error);
  }

  // Add validated values to request
  req.query.page = page.toString();
  req.query.limit = limit.toString();

  next();
};

/**
 * Middleware to validate email format
 */
export const validateEmail = (req: Request, res: Response, next: NextFunction): void => {
  const email = req.body.email;
  
  if (email) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!emailPattern.test(email)) {
      const error = createError('Invalid email format', 400);
      return next(error);
    }
  }

  next();
};

/**
 * Middleware to validate password strength
 */
export const validatePassword = (req: Request, res: Response, next: NextFunction): void => {
  const password = req.body.password;
  
  if (password) {
    if (password.length < 8) {
      const error = createError('Password must be at least 8 characters long', 400);
      return next(error);
    }

    // Check for at least one uppercase letter
    if (!/[A-Z]/.test(password)) {
      const error = createError('Password must contain at least one uppercase letter', 400);
      return next(error);
    }

    // Check for at least one lowercase letter
    if (!/[a-z]/.test(password)) {
      const error = createError('Password must contain at least one lowercase letter', 400);
      return next(error);
    }

    // Check for at least one number
    if (!/\d/.test(password)) {
      const error = createError('Password must contain at least one number', 400);
      return next(error);
    }
  }

  next();
};

/**
 * Middleware to sanitize string inputs
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
  const sanitizeString = (str: string): string => {
    return str.trim().replace(/[<>]/g, '');
  };

  // Sanitize string fields in body
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeString(req.body[key]);
      }
    });
  }

  // Sanitize string fields in query
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = sanitizeString(req.query[key] as string);
      }
    });
  }

  next();
};
