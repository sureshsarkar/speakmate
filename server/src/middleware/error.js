import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

export const notFoundHandler = (req, _res, next) => next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`, 'NOT_FOUND'));

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let status = err.status || 500;
  let code = err.code || 'SERVER_ERROR';
  let message = err.message || 'Something went wrong';
  let details = err.details;

  if (err.name === 'ValidationError' && err.errors) {
    status = 422;
    code = 'VALIDATION_ERROR';
    details = Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v.message]));
    message = Object.values(details)[0];
  } else if (err.name === 'CastError') {
    status = 400;
    code = 'BAD_REQUEST';
    message = 'Invalid identifier';
  } else if (err.code === 11000) {
    status = 409;
    code = 'DUPLICATE';
    message = `That ${Object.keys(err.keyPattern || {})[0] || 'value'} is already in use`;
  } else if (err.name === 'MulterError') {
    status = 400;
    code = 'UPLOAD_ERROR';
    message = err.code === 'LIMIT_FILE_SIZE' ? 'Image is too large (max 2 MB)' : err.message;
  } else if (err.type === 'entity.too.large') {
    status = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'Request is too large';
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    code = 'BAD_JSON';
    message = 'Malformed JSON body';
  }

  if (status >= 500) {
    logger.error(`${req.method} ${req.originalUrl} -> ${status}`, err);
    if (env.isProd) message = 'Something went wrong on our side. Please try again.';
  }
  res.status(status).json({ success: false, code, message, ...(details ? { details } : {}) });
}
