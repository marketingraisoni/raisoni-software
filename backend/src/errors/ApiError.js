import { HTTP_STATUS } from '../constants/httpStatus.js';

export class ApiError extends Error {
  constructor(statusCode, message, errors = undefined) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, errors) {
    return new ApiError(HTTP_STATUS.BAD_REQUEST, message, errors);
  }

  static unauthorized(message) {
    return new ApiError(HTTP_STATUS.UNAUTHORIZED, message);
  }

  static forbidden(message) {
    return new ApiError(HTTP_STATUS.FORBIDDEN, message);
  }

  static notFound(message) {
    return new ApiError(HTTP_STATUS.NOT_FOUND, message);
  }

  static conflict(message, errors) {
    return new ApiError(HTTP_STATUS.CONFLICT, message, errors);
  }

  static tooManyRequests(message) {
    return new ApiError(HTTP_STATUS.TOO_MANY_REQUESTS, message);
  }
}
