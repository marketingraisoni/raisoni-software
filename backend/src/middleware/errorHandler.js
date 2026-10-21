import { logger } from '../utils/logger.js';
import { config } from '../config/env.js';
import { API_MESSAGES } from '../constants/messages.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { ApiError } from '../errors/ApiError.js';
import { sendError } from '../utils/apiResponse.js';

export function errorHandler(err, req, res, _next) {
  let normalizedError = err;

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    normalizedError = ApiError.conflict(API_MESSAGES.COMMON.DUPLICATE_RECORD, [
      { field, message: `${field} must be unique` },
    ]);
  } else if (err.name === 'CastError') {
    normalizedError = ApiError.badRequest(API_MESSAGES.COMMON.INVALID_ID, [
      { field: err.path, message: 'Invalid identifier format' },
    ]);
  } else if (err.name === 'ValidationError') {
    normalizedError = ApiError.badRequest(
      API_MESSAGES.COMMON.VALIDATION_FAILED,
      Object.values(err.errors).map((error) => ({
        field: error.path,
        message: error.message,
      }))
    );
  }

  const statusCode = normalizedError.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
  const isInternalError = statusCode >= HTTP_STATUS.INTERNAL_SERVER_ERROR;

  logger[isInternalError ? 'error' : 'warn'](`${normalizedError.name}: ${normalizedError.message}`, {
    url: req.originalUrl,
    method: req.method,
    statusCode,
    stack: config.env === 'development' ? normalizedError.stack : undefined,
  });

  return sendError(res, {
    statusCode,
    message: isInternalError ? API_MESSAGES.COMMON.INTERNAL_ERROR : normalizedError.message,
    errors: normalizedError.errors,
  });
}
