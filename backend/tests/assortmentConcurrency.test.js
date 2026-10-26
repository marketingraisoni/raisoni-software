import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { config } from '../src/config/env.js';
import { USER_TYPE } from '../src/constants/user.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { AssortmentPacket } from '../src/models/AssortmentPacket.js';
import { AssortmentWriteLock } from '../src/models/AssortmentWriteLock.js';
import { Lot } from '../src/models/Lot.js';
import { User } from '../src/models/User.js';
import lotRoutes from '../src/routes/lotRoutes.js';

let mongod;
let server;
let baseUrl;
let token;

async function createPackets(lotId, entries) {
  return Promise.all(
    entries.map(async ({ carat, requestId }) => {
      const response = await fetch(`${baseUrl}/api/lots/${lotId}/packets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ carat, requestId }),
      });
      return { status: response.status, body: await response.json() };
    })
  );
}

test.before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await AssortmentPacket.createIndexes();
  await AssortmentWriteLock.createIndexes();

  const user = await User.create({
    name: 'Concurrency Tester',
    username: 'concurrencytester',
    email: 'concurrency@test.local',
    password: 'Password@123',
    userType: USER_TYPE.SUPER_ADMIN,
    status: 'active',
  });
  token = jwt.sign(
    { id: user._id, username: user.username, userType: user.userType },
    config.jwtSecret,
    { expiresIn: '5m' }
  );

  const app = express();
  app.use(express.json());
  app.use('/api/lots', lotRoutes);
  app.use(errorHandler);
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  await mongod.stop();
});

test('concurrent packet entries remain ordered and preserve exact totals', async () => {
  const lot = await Lot.create({
    kapanNo: 'CC',
    totalCarat: 1,
    totalPcs: 20,
    entryDate: new Date(),
  });
  const entries = Array.from({ length: 12 }, (_, index) => ({
    carat: 0.05,
    requestId: `concurrent-packet-${index}`,
  }));

  const responses = await createPackets(lot._id, entries);
  assert.equal(responses.every((response) => response.status === 201), true);

  const packets = await AssortmentPacket.find({ lot: lot._id })
    .sort({ srNo: 1 })
    .lean();
  assert.equal(packets.length, 12);
  assert.deepEqual(
    packets.map((packet) => packet.srNo),
    Array.from({ length: 12 }, (_, index) => index + 1)
  );
  assert.equal(
    packets.reduce(
      (total, packet) => total + Math.round(packet.carat * 1000),
      0
    ),
    600
  );
});

test('replaying one request ID returns one packet instead of duplicating it', async () => {
  const lot = await Lot.create({
    kapanNo: 'ID',
    totalCarat: 1,
    totalPcs: 5,
    entryDate: new Date(),
  });
  const responses = await createPackets(lot._id, [
    { carat: 0.25, requestId: 'same-packet-request' },
    { carat: 0.25, requestId: 'same-packet-request' },
  ]);

  assert.deepEqual(
    responses.map((response) => response.status).sort(),
    [200, 201]
  );
  assert.equal(
    responses[0].body.data.packet.id,
    responses[1].body.data.packet.id
  );
  assert.equal(await AssortmentPacket.countDocuments({ lot: lot._id }), 1);
});

test('concurrent packet updates cannot exceed the lot carat total', async () => {
  const lot = await Lot.create({
    kapanNo: 'UP',
    totalCarat: 0.5,
    totalPcs: 2,
    entryDate: new Date(),
  });
  await createPackets(lot._id, [
    { carat: 0.1, requestId: 'update-source-1' },
    { carat: 0.1, requestId: 'update-source-2' },
  ]);
  const packets = await AssortmentPacket.find({ lot: lot._id })
    .sort({ srNo: 1 })
    .lean();

  const responses = await Promise.all(
    packets.map(async (packet) => {
      const response = await fetch(
        `${baseUrl}/api/lots/${lot._id}/packets/${packet._id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ carat: 0.4 }),
        }
      );
      return response.status;
    })
  );

  assert.deepEqual(responses.sort(), [200, 400]);
  const storedPackets = await AssortmentPacket.find({ lot: lot._id }).lean();
  assert.equal(
    storedPackets.reduce(
      (total, packet) => total + Math.round(packet.carat * 1000),
      0
    ),
    500
  );
});
