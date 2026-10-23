import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { USER_STATUS, USER_TYPE_LABEL } from '../constants/user.js';
import { ApiError } from '../errors/ApiError.js';
import { User } from '../models/User.js';
import { ChatMessage } from '../models/ChatMessage.js';
import { emitToUser, isUserOnline, getOnlineUserIds } from '../sockets/socketManager.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const chatUploadsDir = path.resolve(__dirname, '../../../data/uploads/chat');

if (!fs.existsSync(chatUploadsDir)) {
  fs.mkdirSync(chatUploadsDir, { recursive: true });
}

/**
 * Upload chat attachment (max 20 MB)
 */
export const uploadAttachment = asyncHandler(async (req, res) => {
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    throw ApiError.badRequest('No file data provided');
  }

  // Max 20 MB limit
  const maxBytes = 20 * 1024 * 1024;
  if (req.body.length > maxBytes) {
    throw ApiError.badRequest('File size exceeds the 20 MB limit');
  }

  const rawHeaderName = req.headers['x-file-name'];
  let originalName = 'attachment';
  if (rawHeaderName) {
    try {
      originalName = decodeURIComponent(rawHeaderName);
    } catch {
      originalName = String(rawHeaderName);
    }
  }

  const ext = path.extname(originalName) || '';
  const baseName = path
    .basename(originalName, ext)
    .replace(/[^a-zA-Z0-9_\-\.]/g, '_')
    .slice(0, 50);
  const uniquePrefix = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
  const storedFilename = `${uniquePrefix}-${baseName}${ext}`;
  const filePath = path.join(chatUploadsDir, storedFilename);

  await fs.promises.writeFile(filePath, req.body);

  const mimeType = req.headers['content-type'] || 'application/octet-stream';
  const fileUrl = `/uploads/chat/${storedFilename}`;

  return sendSuccess(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: 'Attachment uploaded successfully',
    data: {
      attachment: {
        url: fileUrl,
        filename: storedFilename,
        originalName,
        mimeType,
        size: req.body.length,
      },
    },
  });
});

/**
 * Get all available chat contacts (active users except current user)
 * includes online status, latest message preview, and unread message count
 */
export const getChatUsers = asyncHandler(async (req, res) => {
  const currentUserId = req.user._id;

  const users = await User.find({
    _id: { $ne: currentUserId },
    status: USER_STATUS.ACTIVE,
  })
    .select('name username email userType lastLogin createdAt')
    .lean();

  const userList = await Promise.all(
    users.map(async (u) => {
      const otherId = u._id;

      // Find the most recent message in the conversation
      const lastMessage = await ChatMessage.findOne({
        $or: [
          { sender: currentUserId, recipient: otherId },
          { sender: otherId, recipient: currentUserId },
        ],
      })
        .sort({ createdAt: -1 })
        .select('message attachments sender recipient read createdAt')
        .lean();

      // Count unread messages received from this user
      const unreadCount = await ChatMessage.countDocuments({
        sender: otherId,
        recipient: currentUserId,
        read: false,
      });

      const online = isUserOnline(otherId.toString());

      return {
        id: String(u._id),
        name: u.name,
        username: u.username,
        email: u.email,
        userType: u.userType,
        userTypeLabel: USER_TYPE_LABEL[u.userType] || 'Staff',
        isOnline: online,
        lastLogin: u.lastLogin || null,
        unreadCount,
        lastMessage: lastMessage
          ? {
              id: String(lastMessage._id),
              message:
                lastMessage.message ||
                (lastMessage.attachments?.length
                  ? lastMessage.attachments[0].mimeType?.startsWith('image/')
                    ? '📷 Photo'
                    : '📎 Attachment'
                  : ''),
              hasAttachments: Boolean(lastMessage.attachments?.length),
              senderId: String(lastMessage.sender),
              recipientId: String(lastMessage.recipient),
              read: lastMessage.read,
              createdAt: lastMessage.createdAt,
            }
          : null,
      };
    })
  );

  // Sort contacts: most recent conversation first, then online status, then alphabetical
  userList.sort((a, b) => {
    const aTime = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
    const bTime = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
    if (aTime !== bTime) {
      return bTime - aTime;
    }
    if (a.isOnline !== b.isOnline) {
      return a.isOnline ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  return sendSuccess(res, {
    message: 'Chat users fetched successfully',
    data: { users: userList },
  });
});

/**
 * Get message history between current user and a target user
 * Supports 50-by-50 pagination via limit & before query parameters
 */
export const getChatMessages = asyncHandler(async (req, res) => {
  const currentUserId = req.user._id;
  const { userId } = req.params;
  const rawLimit = parseInt(req.query.limit, 10);
  const limit = Math.min(Math.max(!isNaN(rawLimit) ? rawLimit : 50, 1), 100);
  const before = req.query.before;

  if (!userId) {
    throw ApiError.badRequest('Target user ID is required');
  }

  const targetUser = await User.findById(userId).select('name username userType status').lean();
  if (!targetUser) {
    throw ApiError.notFound('Target user not found');
  }

  // Find the first unread message from this user (if initial load without 'before')
  let firstUnreadId = null;
  if (!before) {
    const firstUnread = await ChatMessage.findOne({
      sender: userId,
      recipient: currentUserId,
      read: false,
    })
      .sort({ createdAt: 1 })
      .select('_id')
      .lean();
    if (firstUnread) {
      firstUnreadId = String(firstUnread._id);
    }
  }

  const filter = {
    $or: [
      { sender: currentUserId, recipient: userId },
      { sender: userId, recipient: currentUserId },
    ],
  };

  if (before) {
    const beforeDate = new Date(before);
    if (!isNaN(beforeDate.getTime())) {
      filter.createdAt = { $lt: beforeDate };
    }
  }

  // Fetch limit messages in descending order (newest first of the window)
  const messages = await ChatMessage.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('sender', 'name username userType')
    .populate('recipient', 'name username userType')
    .lean();

  // Reverse so they are returned in chronological order (oldest to newest)
  messages.reverse();

  let hasMore = false;
  let nextCursor = null;

  if (messages.length > 0) {
    const oldestInBatch = messages[0].createdAt;
    const olderCount = await ChatMessage.countDocuments({
      $or: [
        { sender: currentUserId, recipient: userId },
        { sender: userId, recipient: currentUserId },
      ],
      createdAt: { $lt: oldestInBatch },
    });
    hasMore = olderCount > 0;
    if (hasMore) {
      nextCursor = oldestInBatch instanceof Date ? oldestInBatch.toISOString() : new Date(oldestInBatch).toISOString();
    }
  }

  // Mark incoming unread messages as read
  if (!before) {
    const unreadCount = await ChatMessage.countDocuments({
      sender: userId,
      recipient: currentUserId,
      read: false,
    });

    if (unreadCount > 0) {
      await ChatMessage.updateMany(
        { sender: userId, recipient: currentUserId, read: false },
        { $set: { read: true, readAt: new Date(), delivered: true } }
      );
      emitToUser(userId, 'chat:read', { readerId: String(currentUserId) });
    }
  }

  const formattedMessages = messages.map((m) => ({
    id: String(m._id),
    sender: {
      id: String(m.sender._id),
      name: m.sender.name,
      username: m.sender.username,
      userType: m.sender.userType,
    },
    recipient: {
      id: String(m.recipient._id),
      name: m.recipient.name,
      username: m.recipient.username,
      userType: m.recipient.userType,
    },
    message: m.message || '',
    attachments: m.attachments || [],
    delivered: Boolean(m.delivered),
    deliveredAt: m.deliveredAt || null,
    read: m.read,
    readAt: m.readAt,
    createdAt: m.createdAt,
  }));

  return sendSuccess(res, {
    message: 'Chat messages retrieved',
    data: {
      user: {
        id: String(targetUser._id),
        name: targetUser.name,
        username: targetUser.username,
        userType: targetUser.userType,
        userTypeLabel: USER_TYPE_LABEL[targetUser.userType] || 'Staff',
        isOnline: isUserOnline(userId),
      },
      messages: formattedMessages,
      hasMore,
      nextCursor,
      firstUnreadId,
    },
  });
});

/**
 * Send a new chat message (with optional attachments)
 */
export const sendMessage = asyncHandler(async (req, res) => {
  const currentUserId = req.user._id;
  const { recipientId, message, attachments } = req.body;

  if (!recipientId) {
    throw ApiError.badRequest('Recipient user ID is required');
  }

  const trimmedMessage = typeof message === 'string' ? message.trim() : '';
  const validAttachments = Array.isArray(attachments) ? attachments.slice(0, 10) : [];

  if (!trimmedMessage && validAttachments.length === 0) {
    throw ApiError.badRequest('Message or attachment is required');
  }

  if (String(recipientId) === String(currentUserId)) {
    throw ApiError.badRequest('Cannot send a message to yourself');
  }

  const recipient = await User.findById(recipientId).select('name username userType status').lean();
  if (!recipient || recipient.status !== USER_STATUS.ACTIVE) {
    throw ApiError.notFound('Recipient not found or is inactive');
  }

  const isDelivered = isUserOnline(recipientId);

  const chatMessage = await ChatMessage.create({
    sender: currentUserId,
    recipient: recipientId,
    message: trimmedMessage,
    attachments: validAttachments,
    delivered: isDelivered,
    deliveredAt: isDelivered ? new Date() : null,
  });

  const populated = await ChatMessage.findById(chatMessage._id)
    .populate('sender', 'name username userType')
    .populate('recipient', 'name username userType')
    .lean();

  const formattedMessage = {
    id: String(populated._id),
    sender: {
      id: String(populated.sender._id),
      name: populated.sender.name,
      username: populated.sender.username,
      userType: populated.sender.userType,
    },
    recipient: {
      id: String(populated.recipient._id),
      name: populated.recipient.name,
      username: populated.recipient.username,
      userType: populated.recipient.userType,
    },
    message: populated.message,
    attachments: populated.attachments || [],
    delivered: populated.delivered,
    deliveredAt: populated.deliveredAt,
    read: populated.read,
    readAt: populated.readAt,
    createdAt: populated.createdAt,
  };

  // Real-time live reflection: emit to recipient and sender via WebSockets
  emitToUser(recipientId, 'chat:message', formattedMessage);
  emitToUser(currentUserId, 'chat:message', formattedMessage);

  return sendSuccess(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: 'Message sent successfully',
    data: { message: formattedMessage },
  });
});

/**
 * Mark all messages from a specific user as read
 */
export const markMessagesRead = asyncHandler(async (req, res) => {
  const currentUserId = req.user._id;
  const { userId } = req.params;

  const result = await ChatMessage.updateMany(
    { sender: userId, recipient: currentUserId, read: false },
    { $set: { read: true, readAt: new Date(), delivered: true } }
  );

  if (result.modifiedCount > 0) {
    emitToUser(userId, 'chat:read', { readerId: String(currentUserId) });
  }

  return sendSuccess(res, {
    message: 'Messages marked as read',
    data: { updatedCount: result.modifiedCount },
  });
});

/**
 * Get current online user IDs
 */
export const getOnlineUsers = asyncHandler(async (req, res) => {
  const onlineIds = getOnlineUserIds();
  return sendSuccess(res, {
    message: 'Online users retrieved',
    data: { onlineUserIds: onlineIds },
  });
});

/**
 * Get total unread messages count for current user across all conversations
 */
export const getUnreadCount = asyncHandler(async (req, res) => {
  const currentUserId = req.user._id;
  const count = await ChatMessage.countDocuments({
    recipient: currentUserId,
    read: false,
  });

  return sendSuccess(res, {
    message: 'Total unread count retrieved',
    data: { unreadCount: count },
  });
});
