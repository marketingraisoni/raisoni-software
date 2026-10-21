import { ZodError } from 'zod';
import { API_MESSAGES } from '../constants/messages.js';
import { ApiError } from '../errors/ApiError.js';

export function validate(schema, source = 'body') {
  return async (req, _res, next) => {
    try {
      const parsed = await schema.parseAsync(req[source]);
      req[source] = parsed;
      return next();
    } catch (err) {
      if (err instanceof ZodError) {
        const errors = err.errors.map((error) => ({
          field: error.path.join('.'),
          message: error.message,
          code: error.code,
        }));

        return next(ApiError.badRequest(API_MESSAGES.COMMON.VALIDATION_FAILED, errors));
      }

      return next(ApiError.badRequest(API_MESSAGES.COMMON.INVALID_PAYLOAD));
    }
  };
}
