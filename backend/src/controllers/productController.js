import { HTTP_STATUS } from '../constants/httpStatus.js';
import { API_MESSAGES } from '../constants/messages.js';
import { ApiError } from '../errors/ApiError.js';
import { InventoryMovement } from '../models/InventoryMovement.js';
import { Order } from '../models/Order.js';
import { Product } from '../models/Product.js';
import { logAudit } from '../services/auditService.js';
import { broadcastEvent } from '../sockets/socketManager.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createPaginationMeta, getPagination } from '../utils/pagination.js';

function buildProductQuery({ search = '', category, stockStatus, status }) {
  const query = {};
  if (category && !['all', 'undefined'].includes(category)) query.category = category;
  if (status && !['all', 'undefined'].includes(status)) query.status = status;

  if (stockStatus && !['all', 'undefined'].includes(stockStatus)) {
    if (stockStatus === 'out_of_stock') query.stockQuantity = { $lte: 0 };
    if (stockStatus === 'low_stock') {
      query.stockQuantity = { $gt: 0 };
      query.$expr = { $lte: ['$stockQuantity', '$minStockThreshold'] };
    }
    if (stockStatus === 'in_stock') {
      query.$expr = { $gt: ['$stockQuantity', '$minStockThreshold'] };
    }
  }

  if (search.trim()) {
    const regex = new RegExp(search.trim().replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i');
    query.$or = [{ name: regex }, { sku: regex }, { category: regex }];
  }
  return query;
}

export const getProducts = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const query = buildProductQuery(req.query);
  const [total, products] = await Promise.all([
    Product.countDocuments(query),
    Product.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
  ]);

  return sendSuccess(res, {
    message: API_MESSAGES.PRODUCT.LIST_SUCCESS,
    data: { products, pagination: createPaginationMeta({ page, limit, total }) },
  });
});

export const getCategories = asyncHandler(async (_req, res) => {
  const categories = (await Product.distinct('category')).sort();
  return sendSuccess(res, {
    message: API_MESSAGES.PRODUCT.CATEGORIES_RETRIEVED,
    data: { categories },
  });
});

export const getProductById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw ApiError.notFound(API_MESSAGES.PRODUCT.NOT_FOUND);

  const recentMovements = await InventoryMovement.find({ product: product._id })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  return sendSuccess(res, {
    message: API_MESSAGES.PRODUCT.RETRIEVED,
    data: { product, recentMovements },
  });
});

export const createProduct = asyncHandler(async (req, res) => {
  const product = await Product.create(req.body);

  if (product.stockQuantity > 0) {
    await InventoryMovement.create({
      product: product._id,
      sku: product.sku,
      productName: product.name,
      type: 'initial',
      previousQuantity: 0,
      changeQuantity: product.stockQuantity,
      newQuantity: product.stockQuantity,
      reason: 'Initial stock on creation',
      performedBy: req.user?._id,
      performedByName: req.user?.name || 'Staff',
    });
  }

  await logAudit({
    action: 'PRODUCT_CREATED',
    entityType: 'Product',
    entityId: product._id.toString(),
    user: req.user,
    req,
    details: { sku: product.sku, name: product.name, stock: product.stockQuantity },
  });
  broadcastEvent('product:created', { productId: product._id });

  return sendSuccess(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: API_MESSAGES.PRODUCT.CREATED,
    data: { product },
  });
});

export const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw ApiError.notFound(API_MESSAGES.PRODUCT.NOT_FOUND);

  const newStock = req.body.stockQuantity;
  if (newStock !== undefined && newStock !== product.stockQuantity) {
    await InventoryMovement.create({
      product: product._id,
      sku: product.sku,
      productName: product.name,
      type: 'adjustment',
      previousQuantity: product.stockQuantity,
      changeQuantity: newStock - product.stockQuantity,
      newQuantity: newStock,
      reason: 'Direct product update',
      performedBy: req.user?._id,
      performedByName: req.user?.name || 'Staff',
    });
  }

  Object.assign(product, req.body);
  await product.save();

  await logAudit({
    action: 'PRODUCT_UPDATED',
    entityType: 'Product',
    entityId: product._id.toString(),
    user: req.user,
    req,
    details: { sku: product.sku, name: product.name },
  });
  broadcastEvent('product:updated', { productId: product._id });

  return sendSuccess(res, {
    message: API_MESSAGES.PRODUCT.UPDATED,
    data: { product },
  });
});

export const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw ApiError.notFound(API_MESSAGES.PRODUCT.NOT_FOUND);

  const orderCount = await Order.countDocuments({ 'items.product': product._id });
  if (orderCount > 0) {
    throw ApiError.badRequest(API_MESSAGES.PRODUCT.IN_USE(product.name, orderCount));
  }

  await product.deleteOne();
  await logAudit({
    action: 'PRODUCT_DELETED',
    entityType: 'Product',
    entityId: product._id.toString(),
    user: req.user,
    req,
    details: { sku: product.sku, name: product.name },
  });
  broadcastEvent('product:deleted', { productId: product._id });

  return sendSuccess(res, {
    message: API_MESSAGES.PRODUCT.DELETED,
    data: { id: product._id.toString() },
  });
});
