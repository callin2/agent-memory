/**
 * Error Handling Middleware
 *
 * Provides centralized error handling for Admin Server.
 * Logs errors and returns appropriate HTTP responses.
 */

import express from 'express';

/**
 * Error handler middleware for Express
 *
 * Logs error details and returns formatted error response.
 * In development, includes stack trace for debugging.
 * In production, returns generic error message for security.
 */
export const errorHandler = (
  err: any,
  _req: express.Request,
  res: express.Response,
  _next: express.NextFunction
): void => {
  console.error('Admin Server Error:', err);

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';

  res.status(err.status || 500).json({
    error: isDevelopment ? err.message : 'Internal server error',
    ...(isDevelopment && { stack: err.stack }),
  });
};
