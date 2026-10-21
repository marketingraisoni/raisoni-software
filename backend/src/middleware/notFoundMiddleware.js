import { ApiError } from '../errors/ApiError.js';

export function apiNotFound(req, res, next) {
  next(ApiError.notFound(`API endpoint '${req.method} ${req.originalUrl}' not found`));
}
