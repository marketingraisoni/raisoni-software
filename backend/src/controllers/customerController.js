import { HTTP_STATUS } from '../constants/httpStatus.js';
import { API_MESSAGES } from '../constants/messages.js';
import { ApiError } from '../errors/ApiError.js';
import { Customer } from '../models/Customer.js';
import { Order } from '../models/Order.js';
import { logAudit } from '../services/auditService.js';
import { broadcastEvent } from '../sockets/socketManager.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createPaginationMeta, getPagination } from '../utils/pagination.js';

function buildCustomerQuery({ search = '', status }) {
  const query = {};
  if (status && !['all', 'undefined'].includes(status)) query.status = status;

  if (search.trim()) {
    const regex = new RegExp(search.trim().replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i');
    query.$or = [{ name: regex }, { email: regex }, { phone: regex }, { company: regex }];
  }
  return query;
}

export const getCustomers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const query = buildCustomerQuery(req.query);
  const [total, customers] = await Promise.all([
    Customer.countDocuments(query),
    Customer.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
  ]);

  return sendSuccess(res, {
    message: API_MESSAGES.CUSTOMER.LIST_SUCCESS,
    data: { customers, pagination: createPaginationMeta({ page, limit, total }) },
  });
});

export const getCustomerById = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) throw ApiError.notFound(API_MESSAGES.CUSTOMER.NOT_FOUND);

  const recentOrders = await Order.find({ customer: customer._id })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  return sendSuccess(res, {
    message: API_MESSAGES.CUSTOMER.RETRIEVED,
    data: { customer, recentOrders },
  });
});

export const createCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.create(req.body);

  await logAudit({
    action: 'CUSTOMER_CREATED',
    entityType: 'Customer',
    entityId: customer._id.toString(),
    user: req.user,
    req,
    details: { name: customer.name, email: customer.email },
  });
  broadcastEvent('customer:created', { customerId: customer._id });

  return sendSuccess(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: API_MESSAGES.CUSTOMER.CREATED,
    data: { customer },
  });
});

export const updateCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findByIdAndUpdate(
    req.params.id,
    { $set: req.body },
    { new: true, runValidators: true }
  );
  if (!customer) throw ApiError.notFound(API_MESSAGES.CUSTOMER.NOT_FOUND);

  await logAudit({
    action: 'CUSTOMER_UPDATED',
    entityType: 'Customer',
    entityId: customer._id.toString(),
    user: req.user,
    req,
    details: { name: customer.name },
  });
  broadcastEvent('customer:updated', { customerId: customer._id });

  return sendSuccess(res, {
    message: API_MESSAGES.CUSTOMER.UPDATED,
    data: { customer },
  });
});

export const deleteCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) throw ApiError.notFound(API_MESSAGES.CUSTOMER.NOT_FOUND);

  const orderCount = await Order.countDocuments({ customer: customer._id });
  if (orderCount > 0) {
    throw ApiError.badRequest(API_MESSAGES.CUSTOMER.HAS_ORDERS(orderCount));
  }

  await customer.deleteOne();
  await logAudit({
    action: 'CUSTOMER_DELETED',
    entityType: 'Customer',
    entityId: customer._id.toString(),
    user: req.user,
    req,
    details: { name: customer.name },
  });
  broadcastEvent('customer:deleted', { customerId: customer._id });

  return sendSuccess(res, {
    message: API_MESSAGES.CUSTOMER.DELETED,
    data: { id: customer._id.toString() },
  });
});
