import { logger } from '../utils/logger.js';
import { API_MESSAGES } from '../constants/messages.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { ApiError } from '../errors/ApiError.js';
import { sendError } from '../utils/apiResponse.js';

function normalizeError(err) {
  if (err instanceof ApiError) return err;

  if (err?.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return ApiError.conflict(API_MESSAGES.COMMON.DUPLICATE_RECORD, [
      { field, message: `${field} must be unique` },
    ]);
  }
  if (err?.name === 'CastError') {
    return ApiError.badRequest(API_MESSAGES.COMMON.INVALID_ID, [
      { field: err.path, message: 'Invalid identifier format' },
    ]);
  }
  if (err?.name === 'ValidationError' && err.errors) {
    return ApiError.badRequest(
      API_MESSAGES.COMMON.VALIDATION_FAILED,
      Object.values(err.errors).map((error) => ({ field: error.path, message: error.message }))
    );
  }
  // body-parser / express.raw errors
  if (err?.type === 'entity.parse.failed') {
    return ApiError.badRequest('Request body is not valid JSON.');
  }
  if (err?.type === 'entity.too.large') {
    return new ApiError(413, 'Request body is too large.');
  }
  return err;
}

export function errorHandler(err, req, res, next) {
  const normalizedError = normalizeError(err) || new Error('Unknown error');
  const statusCode = normalizedError.statusCode || normalizedError.status || HTTP_STATUS.INTERNAL_SERVER_ERROR;
  const isInternalError = statusCode >= HTTP_STATUS.INTERNAL_SERVER_ERROR;
  const requestId = req.requestId || res.locals?.requestId;

  const meta = {
    statusCode,
    errorName: normalizedError.name,
    ...(normalizedError.errors ? { validation: normalizedError.errors } : {}),
    // Unexpected errors always keep the full original error (stack, code, cause) in the logs;
    // the client only ever sees a generic message plus the requestId to report.
    // Expected 4xx errors (bad token, validation) are logged without a stack to keep logs readable.
    ...(isInternalError ? { error: err } : {}),
  };

  if (res.headersSent) {
    logger.error(`Error after response was already sent: ${normalizedError.message}`, { ...meta, error: err });
    return next(err); // Let Express close the broken connection.
  }

  if (isInternalError) {
    logger.error(`Unhandled ${normalizedError.name || 'Error'} on ${req.method} ${req.originalUrl}: ${normalizedError.message}`, meta);
  } else {
    logger.warn(`${normalizedError.name}: ${normalizedError.message}`, meta);
  }

  return sendError(res, {
    statusCode,
    message: isInternalError ? API_MESSAGES.COMMON.INTERNAL_ERROR : normalizedError.message,
    errors: normalizedError.errors,
    requestId,
  });
}
