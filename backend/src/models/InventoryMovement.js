import mongoose from 'mongoose';

const inventoryMovementSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    sku: {
      type: String,
      required: true
    },
    productName: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['sale', 'purchase', 'adjustment', 'return', 'order_cancellation', 'initial'],
      required: true
    },
    previousQuantity: {
      type: Number,
      required: true
    },
    changeQuantity: {
      type: Number,
      required: true
    },
    newQuantity: {
      type: Number,
      required: true
    },
    referenceOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order'
    },
    reason: {
      type: String,
      default: ''
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    performedByName: {
      type: String,
      default: 'System'
    }
  },
  {
    timestamps: true
  }
);

inventoryMovementSchema.index({ product: 1, createdAt: -1 });
inventoryMovementSchema.index({ type: 1 });
inventoryMovementSchema.index({ createdAt: -1 });

export const InventoryMovement = mongoose.model('InventoryMovement', inventoryMovementSchema);
