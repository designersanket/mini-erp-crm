import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';
import { env } from '../config/env';

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      details: err.details,
    });
  }

  // MySQL duplicate entry
  const mysqlErr = err as { code?: string; sqlMessage?: string };
  if (mysqlErr?.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      success: false,
      message: 'Duplicate value violates a unique constraint',
      details: mysqlErr.sqlMessage,
    });
  }
  if (mysqlErr?.code === 'ER_NO_REFERENCED_ROW_2' || mysqlErr?.code === 'ER_NO_REFERENCED_ROW') {
    return res.status(400).json({
      success: false,
      message: 'Referenced record does not exist',
      details: mysqlErr.sqlMessage,
    });
  }

  // eslint-disable-next-line no-console
  console.error('[unhandled error]', err);

  res.status(500).json({
    success: false,
    message: 'Internal server error',
    stack: env.nodeEnv === 'development' ? (err as Error)?.stack : undefined,
  });
}
