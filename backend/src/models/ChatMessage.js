import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
    },
    filename: {
      type: String,
      required: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      default: 'application/octet-stream',
    },
    size: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

const chatMessageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    message: {
      type: String,
      default: '',
      trim: true,
      maxlength: [4000, 'Message cannot exceed 4000 characters'],
    },
    attachments: {
      type: [attachmentSchema],
      default: [],
    },
    delivered: {
      type: Boolean,
      default: false,
      index: true,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for optimal querying of conversation history & unread counters
chatMessageSchema.index({ sender: 1, recipient: 1, createdAt: 1 });
chatMessageSchema.index({ recipient: 1, sender: 1, createdAt: 1 });
chatMessageSchema.index({ recipient: 1, read: 1 });

export const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);
