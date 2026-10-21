import { API_MESSAGES } from '../constants/messages.js';
import { InventoryMovement } from '../models/InventoryMovement.js';
import { Product } from '../models/Product.js';
import { logAudit } from '../services/auditService.js';
import { adjustStockManual } from '../services/stockService.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createPaginationMeta, getPagination } from '../utils/pagination.js';

export const getStockOverview = asyncHandler(async (_req, res) => {
  const [totalProducts, inStock, lowStock, outOfStock, valuationRows] = await Promise.all([
    Product.countDocuments(),
    Product.countDocuments({ $expr: { $gt: ['$stockQuantity', '$minStockThreshold'] } }),
    Product.countDocuments({ stockQuantity: { $gt: 0 }, $expr: { $lte: ['$stockQuantity', '$minStockThreshold'] } }),
    Product.countDocuments({ stockQuantity: { $lte: 0 } }),
    Product.aggregate([{ $group: {
      _id: null,
      totalCostValue: { $sum: { $multiply: ['$costPrice', '$stockQuantity'] } },
      totalRetailValue: { $sum: { $multiply: ['$sellingPrice', '$stockQuantity'] } },
    } }]),
  ]);
  const valuation = valuationRows[0] || { totalCostValue: 0, totalRetailValue: 0 };

  return sendSuccess(res, {
    message: API_MESSAGES.INVENTORY.OVERVIEW_RETRIEVED,
    data: { overview: {
      totalProducts,
      inStock,
      lowStock,
      outOfStock,
      totalCostValue: Math.round(valuation.totalCostValue * 100) / 100,
      totalRetailValue: Math.round(valuation.totalRetailValue * 100) / 100,
    } },
  });
});

export const getLowStockProducts = asyncHandler(async (_req, res) => {
  const products = await Product.find({
    $expr: { $lte: ['$stockQuantity', '$minStockThreshold'] },
  }).sort({ stockQuantity: 1 });

  return sendSuccess(res, {
    message: API_MESSAGES.INVENTORY.LOW_STOCK_RETRIEVED,
    data: { products, count: products.length },
  });
});

export const adjustStock = asyncHandler(async (req, res) => {
  const { productId, changeQuantity, reason } = req.body;
  const result = await adjustStockManual({ productId, changeQuantity, reason, user: req.user });

  await logAudit({
    action: 'STOCK_ADJUSTMENT',
    entityType: 'Product',
    entityId: productId,
    user: req.user,
    req,
    details: { change: changeQuantity, newStock: result.product.stockQuantity, reason },
  });

  return sendSuccess(res, {
    message: API_MESSAGES.INVENTORY.STOCK_ADJUSTED,
    data: { product: result.product, movement: result.movement },
  });
});

export const getMovements = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, 15);
  const query = {};
  if (req.query.productId) query.product = req.query.productId;
  if (req.query.type && !['all', 'undefined'].includes(req.query.type)) query.type = req.query.type;

  const [total, movements] = await Promise.all([
    InventoryMovement.countDocuments(query),
    InventoryMovement.find(query)
      .populate('performedBy', 'name username')
      .populate('referenceOrder', 'orderNumber')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  return sendSuccess(res, {
    message: API_MESSAGES.INVENTORY.MOVEMENTS_RETRIEVED,
    data: { movements, pagination: createPaginationMeta({ page, limit, total }) },
  });
});
