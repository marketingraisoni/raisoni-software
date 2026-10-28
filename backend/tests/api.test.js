import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'http';
import path from 'node:path';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import jwt from 'jsonwebtoken';

// Models
import { User } from '../src/models/User.js';
import { Customer } from '../src/models/Customer.js';
import { Product } from '../src/models/Product.js';
import { Order } from '../src/models/Order.js';

// Routes & Middlewares
import healthRoutes from '../src/routes/healthRoutes.js';
import authRoutes from '../src/routes/authRoutes.js';
import dashboardRoutes from '../src/routes/dashboardRoutes.js';
import customerRoutes from '../src/routes/customerRoutes.js';
import productRoutes from '../src/routes/productRoutes.js';
import orderRoutes from '../src/routes/orderRoutes.js';
import inventoryRoutes from '../src/routes/inventoryRoutes.js';
import userRoutes from '../src/routes/userRoutes.js';
import permissionRoutes from '../src/routes/permissionRoutes.js';
import settingRoutes from '../src/routes/settingRoutes.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { USER_TYPE } from '../src/constants/user.js';
import {
  PERMISSION_ACTION,
  PERMISSION_MODULE,
} from '../src/constants/permissions.js';
import { getDefaultPermissions } from '../src/services/permissionService.js';
import { config } from '../src/config/env.js';

let mongod;
let testServer;
let baseUrl;
let adminToken = '';
let staffToken = '';
let testCustomer;
let testProduct;

async function request(
  urlPath,
  { method = 'GET', body = null, token = null } = {},
) {
  const url = new URL(urlPath, baseUrl);
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, body: data };
}

test.before(async () => {
  // Start isolated in-memory test database
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);

  // Setup test app
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/customers', customerRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/inventory', inventoryRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/permissions', permissionRoutes);
  app.use('/api/settings', settingRoutes);
  app.use(errorHandler);

  testServer = http.createServer(app);
  await new Promise((resolve) => testServer.listen(0, resolve));
  const port = testServer.address().port;
  baseUrl = `http://127.0.0.1:${port}`;

  // Seed test users
  const admin = await User.create({
    name: 'Test Admin',
    username: 'testadmin',
    email: 'admin@test.local',
    password: 'Password@123',
    userType: USER_TYPE.ADMIN,
    status: 'active',
    permissions: getDefaultPermissions(USER_TYPE.ADMIN),
  });

  const staff = await User.create({
    name: 'Test Staff',
    username: 'teststaff',
    email: 'staff@test.local',
    password: 'Password@123',
    userType: USER_TYPE.STAFF,
    status: 'active',
    permissions: getDefaultPermissions(USER_TYPE.STAFF),
  });

  // Log in to acquire tokens
  const adminLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { username: 'testadmin', password: 'Password@123' },
  });
  adminToken = adminLogin.body.data.token;

  const staffLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { username: 'teststaff', password: 'Password@123' },
  });
  staffToken = staffLogin.body.data.token;
});

test.after(async () => {
  await new Promise((resolve) => testServer.close(resolve));
  await mongoose.disconnect();
  await mongod.stop();
});

test('1. API Health Check endpoint returns valid status', async () => {
  const res = await request('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.data.status, 'ok');
  assert.ok(res.body.data.database.connected);
});

test('1a. Public branding returns the saved login image without authentication', async () => {
  const res = await request('/api/settings/public/branding');

  assert.equal(res.status, 200);
  assert.equal(res.body.data.branding.loginImageUrl, '');
  assert.equal(res.body.data.branding.appName, 'Raisoni ERP');

  const directUpdateRes = await request('/api/settings', {
    method: 'POST',
    token: adminToken,
    body: { key: 'loginImageUrl', value: '' },
  });
  assert.equal(directUpdateRes.status, 400);
});

test('1b. Login branding image upload requires Settings Update', async () => {
  const pngHeader = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  const uploadUrl = new URL('/api/settings/branding/image', baseUrl);

  const forbiddenRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${staffToken}`,
      'Content-Type': 'image/png',
    },
    body: pngHeader,
  });
  assert.equal(forbiddenRes.status, 403);

  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'image/png',
    },
    body: pngHeader,
  });
  const uploadBody = await uploadRes.json();
  assert.equal(uploadRes.status, 200);
  assert.match(
    uploadBody.data.branding.loginImageUrl,
    /^\/uploads\/branding\/login-[a-f0-9]+\.png$/,
  );

  const publicRes = await request('/api/settings/public/branding');
  assert.equal(
    publicRes.body.data.branding.loginImageUrl,
    uploadBody.data.branding.loginImageUrl,
  );

  await fs.promises.rm(
    path.resolve(
      config.dataDir,
      'uploads/branding',
      path.basename(uploadBody.data.branding.loginImageUrl),
    ),
    { force: true },
  );
});

test('2. Authentication - Reject invalid login credentials', async () => {
  const res = await request('/api/auth/login', {
    method: 'POST',
    body: { username: 'testadmin', password: 'WrongPassword' },
  });
  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
});

test('3. Authentication - Successfully login and receive JWT', async () => {
  const res = await request('/api/auth/login', {
    method: 'POST',
    body: { username: 'testadmin', password: 'Password@123' },
  });
  assert.equal(res.status, 200);
  assert.ok(res.body.data.token);
  assert.equal(res.body.data.user.username, 'testadmin');

  const rememberedRes = await request('/api/auth/login', {
    method: 'POST',
    body: {
      username: 'testadmin',
      password: 'Password@123',
      rememberMe: true,
    },
  });
  const standardToken = jwt.decode(res.body.data.token);
  const rememberedToken = jwt.decode(rememberedRes.body.data.token);

  assert.equal(rememberedRes.status, 200);
  assert.ok(rememberedToken.exp > standardToken.exp);
});

test('3a. Profile - Signed-in user can update their name and username', async () => {
  const updateRes = await request('/api/auth/profile', {
    method: 'PUT',
    token: adminToken,
    body: { name: 'Updated Test Admin', username: 'updated.testadmin' },
  });

  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.body.data.user.name, 'Updated Test Admin');
  assert.equal(updateRes.body.data.user.username, 'updated.testadmin');

  const meRes = await request('/api/auth/me', { token: adminToken });
  assert.equal(meRes.status, 200);
  assert.equal(meRes.body.data.user.username, 'updated.testadmin');
});

test('3b. Profile - Signed-in user can upload and remove a profile picture', async () => {
  const pngHeader = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  const uploadRes = await fetch(new URL('/api/auth/profile/photo', baseUrl), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'image/png',
    },
    body: pngHeader,
  });
  const uploadBody = await uploadRes.json();

  assert.equal(uploadRes.status, 200);
  assert.match(uploadBody.data.user.avatarUrl, /^\/uploads\/profile\//);

  const removeRes = await request('/api/auth/profile/photo', {
    method: 'DELETE',
    token: adminToken,
  });
  assert.equal(removeRes.status, 200);
  assert.equal(removeRes.body.data.user.avatarUrl, '');
});

test('3c. Help Center - Support contacts are readable and administrator-configurable', async () => {
  const initialRes = await request('/api/settings/support', {
    token: staffToken,
  });
  assert.equal(initialRes.status, 200);
  assert.equal(
    initialRes.body.data.contacts.administratorEmail,
    'raisonijauharis@gmail.com',
  );

  const updateRes = await request('/api/settings', {
    method: 'POST',
    token: adminToken,
    body: { key: 'administratorPhone', value: '+91 90000 00000' },
  });
  assert.equal(updateRes.status, 200);

  const updatedRes = await request('/api/settings/support', {
    token: staffToken,
  });
  assert.equal(
    updatedRes.body.data.contacts.administratorPhone,
    '+91 90000 00000',
  );
});

test('3d. Password - Signed-in user can change their own password', async () => {
  const changeRes = await request('/api/auth/change-password', {
    method: 'POST',
    token: staffToken,
    body: {
      currentPassword: 'Password@123',
      newPassword: 'NewPassword@456',
    },
  });
  assert.equal(changeRes.status, 200);

  const loginRes = await request('/api/auth/login', {
    method: 'POST',
    body: { username: 'teststaff', password: 'NewPassword@456' },
  });
  assert.equal(loginRes.status, 200);
});

test('4. Security - Reject unauthorized access without token', async () => {
  const res = await request('/api/customers');
  assert.equal(res.status, 401);
});

test('5. Role-based Authorization - Staff cannot delete customers', async () => {
  const cust = await Customer.create({
    name: 'Sample Corp',
    email: 'sample@corp.local',
    phone: '+91 99999 88888',
  });

  const res = await request(`/api/customers/${cust._id}`, {
    method: 'DELETE',
    token: staffToken,
  });
  assert.equal(res.status, 403);
  assert.match(res.body.message, /permission/);
});

test('6. Customers CRUD - Create customer with validation', async () => {
  const res = await request('/api/customers', {
    method: 'POST',
    token: adminToken,
    body: {
      name: 'Narmada Logistics Ltd',
      company: 'Narmada Transport Group',
      email: 'contact@narmadalogistics.local',
      phone: '+91 98222 33445',
      address: { city: 'Nagpur', state: 'Maharashtra' },
    },
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.data.customer.name, 'Narmada Logistics Ltd');
  testCustomer = res.body.data.customer;
});

test('7. Validation - Reject invalid customer email and missing phone', async () => {
  const res = await request('/api/customers', {
    method: 'POST',
    token: adminToken,
    body: {
      name: 'Bad Customer',
      email: 'not-an-email',
    },
  });
  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
});

test('8. Products CRUD - Create product and verify SKU uniqueness', async () => {
  const res = await request('/api/products', {
    method: 'POST',
    token: adminToken,
    body: {
      sku: 'TEST-SKU-100',
      name: 'Industrial Torque Calibrator',
      category: 'Hardware & Tools',
      costPrice: 5000,
      sellingPrice: 7500,
      stockQuantity: 25,
      minStockThreshold: 5,
    },
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.data.product.sku, 'TEST-SKU-100');
  testProduct = res.body.data.product;

  // Attempt duplicate SKU
  const dupRes = await request('/api/products', {
    method: 'POST',
    token: adminToken,
    body: {
      sku: 'TEST-SKU-100',
      name: 'Duplicate Product',
      category: 'Hardware & Tools',
      costPrice: 1000,
      sellingPrice: 1500,
    },
  });
  assert.equal(dupRes.status, 409);
});

test('9. Orders - Server-side price, discount, and tax calculations', async () => {
  const res = await request('/api/orders', {
    method: 'POST',
    token: adminToken,
    body: {
      customer: testCustomer._id,
      items: [
        { product: testProduct._id, quantity: 2 }, // 2 * 7500 = 15000
      ],
      discountPercent: 10, // 1500 discount -> 13500
      taxPercent: 18, // 18% of 13500 = 2430 -> total 15930
      paymentMethod: 'Bank Transfer',
    },
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.data.order.subtotal, 15000);
  assert.equal(res.body.data.order.discountAmount, 1500);
  assert.equal(res.body.data.order.taxAmount, 2430);
  assert.equal(res.body.data.order.totalAmount, 15930);

  // Verify stock decremented from 25 to 23
  const updatedProd = await Product.findById(testProduct._id);
  assert.equal(updatedProd.stockQuantity, 23);
});

test('10. Orders - Reject order when stock is insufficient', async () => {
  const res = await request('/api/orders', {
    method: 'POST',
    token: adminToken,
    body: {
      customer: testCustomer._id,
      items: [
        { product: testProduct._id, quantity: 999 }, // far exceeds 23
      ],
    },
  });

  assert.equal(res.status, 400);
  assert.match(res.body.message, /Insufficient stock/);
});

test('11. Orders - Idempotency protection prevents duplicate submissions', async () => {
  const idemKey = 'idempotency-key-test-uuid-456';

  const order1 = await request('/api/orders', {
    method: 'POST',
    token: adminToken,
    body: {
      customer: testCustomer._id,
      items: [{ product: testProduct._id, quantity: 1 }],
      idempotencyKey: idemKey,
    },
  });
  assert.equal(order1.status, 201);

  // Duplicate submission with identical key
  const order2 = await request('/api/orders', {
    method: 'POST',
    token: adminToken,
    body: {
      customer: testCustomer._id,
      items: [{ product: testProduct._id, quantity: 1 }],
      idempotencyKey: idemKey,
    },
  });

  assert.equal(order2.status, 200);
  assert.equal(
    order2.body.data.order.orderNumber,
    order1.body.data.order.orderNumber,
  );
});

test('12. Order Cancellation - Automatically restores inventory', async () => {
  const orderRes = await request('/api/orders', {
    method: 'POST',
    token: adminToken,
    body: {
      customer: testCustomer._id,
      items: [{ product: testProduct._id, quantity: 3 }],
    },
  });
  assert.equal(orderRes.status, 201);
  const orderId = orderRes.body.data.order._id;

  const stockBeforeCancel = (await Product.findById(testProduct._id))
    .stockQuantity;

  // Cancel the order
  const cancelRes = await request(`/api/orders/${orderId}/status`, {
    method: 'PATCH',
    token: adminToken,
    body: {
      status: 'Cancelled',
      cancelledReason: 'Customer order cancelled during test',
    },
  });

  assert.equal(cancelRes.status, 200);
  assert.equal(cancelRes.body.data.order.status, 'Cancelled');

  // Verify stock restored by +3
  const stockAfterCancel = (await Product.findById(testProduct._id))
    .stockQuantity;
  assert.equal(stockAfterCancel, stockBeforeCancel + 3);
});

test('13. Inventory - Manual stock adjustment with audit trail', async () => {
  const prevStock = (await Product.findById(testProduct._id)).stockQuantity;

  const adjRes = await request('/api/inventory/adjust', {
    method: 'POST',
    token: adminToken,
    body: {
      productId: testProduct._id,
      changeQuantity: 10,
      reason: 'Physical stock intake verification',
    },
  });

  assert.equal(adjRes.status, 200);
  assert.equal(adjRes.body.data.product.stockQuantity, prevStock + 10);
});

test('14. Dashboard - Real database calculated metrics', async () => {
  const res = await request('/api/dashboard', {
    token: adminToken,
  });

  assert.equal(res.status, 200);
  assert.ok(res.body.data.metrics.totalUsers >= 1);
  assert.ok(res.body.data.metrics.activeUsers >= 1);
  assert.ok(res.body.data.metrics.adminCount >= 1);
  assert.ok(Array.isArray(res.body.data.recentUsers));
});

test('15. Users - Requires authentication and administrator role', async () => {
  const unauthenticated = await request('/api/users');
  assert.equal(unauthenticated.status, 401);

  const staff = await request('/api/users', { token: staffToken });
  assert.equal(staff.status, 403);
});

test('16. Users - Administrator can create, list, update, and delete an account', async () => {
  const createRes = await request('/api/users', {
    method: 'POST',
    token: adminToken,
    body: {
      name: 'API Managed User',
      username: 'api.managed1',
      email: 'api.managed@test.local',
      password: 'Password@123',
      userType: USER_TYPE.STAFF,
      status: 'active',
      notes: 'Created by integration test',
    },
  });

  assert.equal(createRes.status, 201);
  const userId = createRes.body.data.user.id;
  assert.ok(userId);

  const listRes = await request('/api/users', { token: adminToken });
  assert.equal(listRes.status, 200);
  const listedUser = listRes.body.data.users.find((user) => user.id === userId);
  assert.equal(listedUser.username, 'api.managed1');
  assert.equal(listedUser._id, undefined);
  assert.equal(listedUser.password, undefined);
  assert.equal(listedUser.permissions, undefined);

  const updateRes = await request(`/api/users/${userId}`, {
    method: 'PUT',
    token: adminToken,
    body: {
      name: 'Updated API User',
      userType: USER_TYPE.MANAGER,
      status: 'inactive',
    },
  });
  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.body.data.user.name, 'Updated API User');
  assert.equal(updateRes.body.data.user.userType, USER_TYPE.MANAGER);
  assert.equal(updateRes.body.data.user.status, 'inactive');

  const filteredListRes = await request(
    `/api/users?page=1&limit=1&search=updated&userType=${USER_TYPE.MANAGER}&status=inactive&sortBy=name&sortOrder=asc`,
    { token: adminToken },
  );
  assert.equal(filteredListRes.status, 200);
  assert.equal(filteredListRes.body.data.users.length, 1);
  assert.equal(filteredListRes.body.data.users[0].id, userId);
  assert.equal(filteredListRes.body.data.pagination.page, 1);
  assert.equal(filteredListRes.body.data.pagination.limit, 1);
  assert.equal(filteredListRes.body.data.pagination.total, 1);
  assert.equal(filteredListRes.body.data.pagination.totalPages, 1);

  const deleteRes = await request(`/api/users/${userId}`, {
    method: 'DELETE',
    token: adminToken,
  });
  assert.equal(deleteRes.status, 200);
  assert.equal(await User.exists({ _id: userId }), null);
});

test('17. Permission Management - User lookup is independent from User Management', async () => {
  await User.updateOne(
    { username: 'teststaff' },
    {
      $set: {
        permissions: [
          {
            module: PERMISSION_MODULE.PERMISSIONS,
            actions: [PERMISSION_ACTION.READ],
          },
        ],
      },
    },
  );

  const regularUsers = await request('/api/users', { token: staffToken });
  assert.equal(regularUsers.status, 403);

  const permissionUsers = await request('/api/permissions/users', {
    token: staffToken,
  });
  assert.equal(permissionUsers.status, 200);
  assert.ok(Array.isArray(permissionUsers.body.data.users));
});
