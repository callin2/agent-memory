/**
 * Request Logging Middleware
 *
 * Logs all incoming HTTP requests with method, path, and IP address.
 * Useful for debugging and monitoring server activity.
 */

import express from 'express';

/**
 * Request logger middleware for Express
 *
 * Logs method, path, and IP address for each incoming request.
 */
export const requestLogger = (
  req: express.Request,
  _res: express.Response,
  next: express.NextFunction
): void => {
  console.log(`${req.method} ${req.path} from ${req.ip}`);
  next();
};
