import { PAGINATION } from '../constants/pagination.js';

export function getPagination(query, defaultLimit = PAGINATION.DEFAULT_LIMIT) {
  const page = Math.max(PAGINATION.DEFAULT_PAGE, Number.parseInt(query.page || `${PAGINATION.DEFAULT_PAGE}`, 10));
  const limit = Math.min(
    PAGINATION.MAX_LIMIT,
    Math.max(1, Number.parseInt(query.limit || `${defaultLimit}`, 10))
  );

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

export function createPaginationMeta({ page, limit, total }) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
  };
}
