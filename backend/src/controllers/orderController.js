import { HTTP_STATUS } from '../constants/httpStatus.js';
import { API_MESSAGES, resourceNotFoundMessage } from '../constants/messages.js';
import { ApiError } from '../errors/ApiError.js';
import { Customer } from '../models/Customer.js';
import { Order } from '../models/Order.js';
import { Product } from '../models/Product.js';
import { logAudit } from '../services/auditService.js';
import { deductInventoryForOrder, restoreInventoryForOrder } from '../services/stockService.js';
import { broadcastEvent } from '../sockets/socketManager.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createPaginationMeta, getPagination } from '../utils/pagination.js';

async function generateOrderNumber() {
  const year = new Date().getFullYear();
  const sequence = String((await Order.countDocuments()) + 1).padStart(4, '0');
  let orderNumber = `ORD-${year}-${sequence}`;
  let suffix = 1;

  while (await Order.exists({ orderNumber })) {
    orderNumber = `ORD-${year}-${sequence}-${suffix}`;
    suffix += 1;
  }
  return orderNumber;
}

async function prepareOrderItems(requestedItems) {
  const populatedItems = [];
  let subtotal = 0;

  for (const item of requestedItems) {
    const product = await Product.findById(item.product);
    if (!product) throw ApiError.notFound(resourceNotFoundMessage(`Product '${item.product}'`));
    if (product.status !== 'active') {
      throw ApiError.badRequest(API_MESSAGES.ORDER.PRODUCT_INACTIVE(product.name));
    }
    if (product.stockQuantity < item.quantity) {
      throw ApiError.badRequest(
        API_MESSAGES.ORDER.INSUFFICIENT_STOCK(product.name, product.stockQuantity, item.quantity)
      );
    }

    const total = Math.round(product.sellingPrice * item.quantity * 100) / 100;
    subtotal += total;
    populatedItems.push({
      product: product._id,
      sku: product.sku,
      name: product.name,
      unitCost: product.costPrice,
      unitPrice: product.sellingPrice,
      quantity: item.quantity,
      total,
    });
  }

  return { populatedItems, subtotal };
}

export const createOrder = asyncHandler(async (req, res) => {
  const {
    customer: customerId,
    items: requestedItems,
    discountPercent = 0,
    taxPercent = 0,
    paymentMethod = 'Cash',
    notes = '',
    idempotencyKey,
  } = req.body;

  if (idempotencyKey) {
    const existingOrder = await Order.findOne({ idempotencyKey })
      .populate('customer', 'name email phone company');
    if (existingOrder) {
      return sendSuccess(res, {
        message: API_MESSAGES.ORDER.IDEMPOTENT,
        data: { order: existingOrder },
      });
    }
  }

  const customer = await Customer.findById(customerId);
  if (!customer) throw ApiError.notFound(API_MESSAGES.CUSTOMER.NOT_FOUND);
  if (customer.status !== 'active') {
    throw ApiError.badRequest(API_MESSAGES.ORDER.CUSTOMER_INACTIVE);
  }

  const { populatedItems, subtotal } = await prepareOrderItems(requestedItems);
  const safeDiscountPercent = Math.max(0, Math.min(100, Number(discountPercent) || 0));
  const safeTaxPercent = Math.max(0, Math.min(100, Number(taxPercent) || 0));
  const discountAmount = Math.round(subtotal * (safeDiscountPercent / 100) * 100) / 100;
  const subtotalAfterDiscount = subtotal - discountAmount;
  const taxAmount = Math.round(subtotalAfterDiscount * (safeTaxPercent / 100) * 100) / 100;
  const totalAmount = Math.round((subtotalAfterDiscount + taxAmount) * 100) / 100;

  const order = new Order({
    orderNumber: await generateOrderNumber(),
    idempotencyKey,
    customer: customer._id,
    customerSnapshot: { name: customer.name, email: customer.email, phone: customer.phone },
    items: populatedItems,
    subtotal,
    discountPercent: safeDiscountPercent,
    discountAmount,
    taxPercent: safeTaxPercent,
    taxAmount,
    totalAmount,
    status: 'Pending',
    paymentMethod,
    notes,
    createdBy: req.user?._id,
  });

  await deductInventoryForOrder(populatedItems, order, req.user);
  await order.save();

  await logAudit({
    action: 'ORDER_CREATED',
    entityType: 'Order',
    entityId: order._id.toString(),
    user: req.user,
    req,
    details: { orderNumber: order.orderNumber, totalAmount, itemCount: order.items.length },
  });
  broadcastEvent('order:created', {
    orderId: order._id,
    orderNumber: order.orderNumber,
    totalAmount,
  });

  return sendSuccess(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: API_MESSAGES.ORDER.CREATED,
    data: { order },
  });
});

export const getOrders = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const query = {};
  if (req.query.status && !['all', 'undefined'].includes(req.query.status)) {
    query.status = req.query.status;
  }
  if (req.query.search?.trim()) {
    const regex = new RegExp(req.query.search.trim().replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i');
    query.$or = [
      { orderNumber: regex },
      { 'customerSnapshot.name': regex },
      { 'customerSnapshot.phone': regex },
    ];
  }

  const [total, orders] = await Promise.all([
    Order.countDocuments(query),
    Order.find(query)
      .populate('customer', 'name email phone company')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  return sendSuccess(res, {
    message: API_MESSAGES.ORDER.LIST_SUCCESS,
    data: { orders, pagination: createPaginationMeta({ page, limit, total }) },
  });
});

export const getOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate('customer')
    .populate('createdBy', 'name username');
  if (!order) throw ApiError.notFound(API_MESSAGES.ORDER.NOT_FOUND);

  return sendSuccess(res, {
    message: API_MESSAGES.ORDER.RETRIEVED,
    data: { order },
  });
});

export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status, cancelledReason } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) throw ApiError.notFound(API_MESSAGES.ORDER.NOT_FOUND);
  if (order.status === 'Cancelled') {
    throw ApiError.badRequest(API_MESSAGES.ORDER.ALREADY_CANCELLED);
  }

  const previousStatus = order.status;
  order.status = status;
  if (status === 'Cancelled') {
    order.cancelledReason = cancelledReason || 'Cancelled by staff';
    order.cancelledAt = new Date();
    await restoreInventoryForOrder(order, req.user, order.cancelledReason);
  }
  await order.save();

  await logAudit({
    action: 'ORDER_STATUS_UPDATED',
    entityType: 'Order',
    entityId: order._id.toString(),
    user: req.user,
    req,
    details: { orderNumber: order.orderNumber, from: previousStatus, to: status, reason: cancelledReason },
  });
  broadcastEvent('order:updated', { orderId: order._id, orderNumber: order.orderNumber, status });

  return sendSuccess(res, {
    message: API_MESSAGES.ORDER.STATUS_UPDATED(status),
    data: { order },
  });
});
