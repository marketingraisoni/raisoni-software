import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    sku: {
      type: String,
      required: [true, 'SKU is required'],
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: 50
    },
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: 150
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      maxlength: 60
    },
    description: {
      type: String,
      default: '',
      trim: true
    },
    costPrice: {
      type: Number,
      required: [true, 'Cost price is required'],
      min: [0, 'Cost price cannot be negative']
    },
    sellingPrice: {
      type: Number,
      required: [true, 'Selling price is required'],
      min: [0, 'Selling price cannot be negative']
    },
    stockQuantity: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Stock quantity cannot be negative']
    },
    minStockThreshold: {
      type: Number,
      default: 10,
      min: [0, 'Threshold cannot be negative']
    },
    status: {
      type: String,
      enum: ['active', 'discontinued'],
      default: 'active'
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for dynamic stock status
productSchema.virtual('stockStatus').get(function () {
  if (this.stockQuantity <= 0) return 'out_of_stock';
  if (this.stockQuantity <= this.minStockThreshold) return 'low_stock';
  return 'in_stock';
});

// Dynamic virtuals and compound search index
productSchema.index({ name: 'text', category: 'text', sku: 'text' });

export const Product = mongoose.model('Product', productSchema);
