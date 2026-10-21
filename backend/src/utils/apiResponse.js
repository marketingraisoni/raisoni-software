import { API_MESSAGES } from '../constants/messages.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

function serializeApiData(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(serializeApiData);
  if (typeof value !== 'object') return value;

  const serializable = typeof value.toJSON === 'function'
    ? value.toJSON()
    : value;

  if (serializable === null || typeof serializable !== 'object') {
    return serializable;
  }
  if (Array.isArray(serializable)) {
    return serializable.map(serializeApiData);
  }

  const result = {};
  for (const [key, item] of Object.entries(serializable)) {
    if (key === '_id' || key === '__v') continue;
    result[key] = serializeApiData(item);
  }

  if (result.id === undefined && serializable._id !== undefined) {
    result.id = serializeApiData(serializable._id);
  }

  return result;
}

export function sendSuccess(
  res,
  {
    statusCode = HTTP_STATUS.OK,
    message = API_MESSAGES.COMMON.SUCCESS,
    data = null,
  } = {}
) {
  return res.status(statusCode).json({
    success: true,
    message,
    data: serializeApiData(data),
  });
}

export function sendError(res, { statusCode, message, errors }) {
  const payload = {
    success: false,
    message,
  };

  if (errors !== undefined) {
    payload.errors = serializeApiData(errors);
  }

  return res.status(statusCode).json(payload);
}
