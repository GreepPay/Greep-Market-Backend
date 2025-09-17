import { Request, Response, NextFunction } from 'express';
import { notFoundError } from './errorHandler';

export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  const error = notFoundError(`Route ${req.originalUrl} not found`);
  next(error);
};
