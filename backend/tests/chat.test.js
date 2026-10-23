import test from 'node:test';
import assert from 'node:assert/strict';
import { isUserOnline, getOnlineUserIds } from '../src/sockets/socketManager.js';
import { ChatMessage } from '../src/models/ChatMessage.js';

test('ChatMessage schema validates sender and recipient fields', () => {
  const invalidMsg = new ChatMessage({});
  const validationError = invalidMsg.validateSync();
  assert.ok(validationError.errors.sender, 'Sender is required');
  assert.ok(validationError.errors.recipient, 'Recipient is required');
  assert.equal(invalidMsg.message, '');
  assert.ok(Array.isArray(invalidMsg.attachments));
});

test('SocketManager online status helpers handle unknown users correctly', () => {
  assert.equal(isUserOnline('non-existent-user-id'), false);
  assert.equal(isUserOnline(null), false);
  assert.equal(isUserOnline(undefined), false);
  assert.ok(Array.isArray(getOnlineUserIds()));
});
