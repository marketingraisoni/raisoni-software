import mongoose from 'mongoose';
import { Product } from '../models/Product.js';
import { InventoryMovement } from '../models/InventoryMovement.js';
import { broadcastEvent } from '../sockets/socketManager.js';
import { logger } from '../utils/logger.js';

/**
 * Checks whether the current MongoDB connection supports multi-document transactions (requires Replica Set)
 */
export async function supportsTransactions() {
  try {
    if (!mongoose.connection.db) return false;
    const isMaster = await mongoose.connection.db.admin().command({ isMaster: 1 });
    return Boolean(isMaster.setName);
  } catch {
    return false;
  }
}

/**
 * Atomically reserve inventory for order items.
 * Uses native transactions when running on a replica set.
 * On standalone MongoDB, uses atomic condition checks ($inc with $gte) with automatic compensating rollback.
 */
export async function deductInventoryForOrder(items, order, user) {
  const hasTx = await supportsTransactions();

  if (hasTx) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const movements = [];
      for (const item of items) {
        const product = await Product.findOne({
          _id: item.product,
          stockQuantity: { $gte: item.quantity }
        }).session(session);

        if (!product) {
          throw new Error(`Insufficient stock for product '${item.name}' (SKU: ${item.sku})`);
        }

        const prevQty = product.stockQuantity;
        product.stockQuantity -= item.quantity;
        await product.save({ session });

        movements.push({
          product: product._id,
          sku: product.sku,
          productName: product.name,
          type: 'sale',
          previousQuantity: prevQty,
          changeQuantity: -item.quantity,
          newQuantity: product.stockQuantity,
          referenceOrder: order._id,
          reason: `Order ${order.orderNumber}`,
          performedBy: user?._id,
          performedByName: user?.name || 'Staff'
        });
      }

      await InventoryMovement.insertMany(movements, { session });
      await session.commitTransaction();
      session.endSession();

      broadcastEvent('inventory:updated', { orderNumber: order.orderNumber });
      return true;
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
  } else {
    // Standalone MongoDB strategy: Atomic conditional update with compensating rollback
    const updatedProducts = [];
    const movements = [];

    try {
      for (const item of items) {
        // Atomic check and decrement in one operation
        const updated = await Product.findOneAndUpdate(
          {
            _id: item.product,
            stockQuantity: { $gte: item.quantity }
          },
          {
            $inc: { stockQuantity: -item.quantity }
          },
          { new: false } // returns document before update
        );

        if (!updated) {
          const currentProd = await Product.findById(item.product);
          const available = currentProd ? currentProd.stockQuantity : 0;
          throw new Error(`Insufficient stock for product '${item.name}'. Available: ${available}, Requested: ${item.quantity}`);
        }

        updatedProducts.push({
          productId: item.product,
          quantity: item.quantity
        });

        movements.push({
          product: updated._id,
          sku: updated.sku,
          productName: updated.name,
          type: 'sale',
          previousQuantity: updated.stockQuantity,
          changeQuantity: -item.quantity,
          newQuantity: updated.stockQuantity - item.quantity,
          referenceOrder: order._id,
          reason: `Order ${order.orderNumber}`,
          performedBy: user?._id,
          performedByName: user?.name || 'Staff'
        });
      }

      // Record inventory movements
      await InventoryMovement.insertMany(movements);
      broadcastEvent('inventory:updated', { orderNumber: order.orderNumber });
      return true;
    } catch (error) {
      // Compensating rollback for any items that were decremented before the failure occurred
      logger.warn(`Order ${order.orderNumber} stock deduction failed: ${error.message}. Running compensating rollback...`);
      for (const comp of updatedProducts) {
        try {
          await Product.findByIdAndUpdate(comp.productId, {
            $inc: { stockQuantity: comp.quantity }
          });
        } catch (rollErr) {
          logger.error(`Critical error rolling back product ${comp.productId}: ${rollErr.message}`);
        }
      }
      throw error;
    }
  }
}

/**
 * Restore inventory when an order is cancelled
 */
export async function restoreInventoryForOrder(order, user, reason = 'Order cancelled') {
  const movements = [];

  for (const item of order.items) {
    const updated = await Product.findByIdAndUpdate(
      item.product,
      { $inc: { stockQuantity: item.quantity } },
      { new: true }
    );

    if (updated) {
      movements.push({
        product: updated._id,
        sku: updated.sku,
        productName: updated.name,
        type: 'order_cancellation',
        previousQuantity: updated.stockQuantity - item.quantity,
        changeQuantity: item.quantity,
        newQuantity: updated.stockQuantity,
        referenceOrder: order._id,
        reason: `${reason} (${order.orderNumber})`,
        performedBy: user?._id,
        performedByName: user?.name || 'Staff'
      });
    }
  }

  if (movements.length > 0) {
    await InventoryMovement.insertMany(movements);
  }

  broadcastEvent('inventory:updated', { orderNumber: order.orderNumber, action: 'restored' });
}

/**
 * Adjust stock manually with audit logging
 */
export async function adjustStockManual({ productId, changeQuantity, reason, user }) {
  const product = await Product.findById(productId);
  if (!product) {
    throw new Error('Product not found');
  }

  const previousQuantity = product.stockQuantity;
  const newQuantity = previousQuantity + changeQuantity;

  if (newQuantity < 0) {
    throw new Error(`Cannot adjust stock below 0. Current stock is ${previousQuantity}.`);
  }

  product.stockQuantity = newQuantity;
  await product.save();

  const movement = await InventoryMovement.create({
    product: product._id,
    sku: product.sku,
    productName: product.name,
    type: 'adjustment',
    previousQuantity,
    changeQuantity,
    newQuantity,
    reason,
    performedBy: user?._id,
    performedByName: user?.name || 'Staff'
  });

  broadcastEvent('inventory:updated', { productId: product._id });
  return { product, movement };
}
