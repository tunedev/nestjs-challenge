// test/order.e2e-spec.ts
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { Model } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';

import { AppModule } from '../src/app.module';
import { Record, RecordDocument } from '../src/api/schemas/record.schema';
import { Order, OrderDocument } from '../src/api/schemas/order.schema';
import { RecordFormat, RecordCategory } from '../src/api/schemas/record.enum';
import { CreateOrderRequestDTO } from '../src/api/dtos/create-order.request.dto';

describe('OrderController (e2e)', () => {
  let app: INestApplication;
  let recordModel: Model<RecordDocument>;
  let orderModel: Model<OrderDocument>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({});
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
      }),
    );
    await app.init();

    recordModel = moduleFixture.get<Model<RecordDocument>>(
      getModelToken(Record.name),
    );
    orderModel = moduleFixture.get<Model<OrderDocument>>(
      getModelToken(Order.name),
    );
  });

  afterEach(async () => {
    await orderModel.deleteMany({});
    await recordModel.deleteMany({});
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/orders (POST)', () => {
    it('should create an order, decrement stock, and return populated response', async () => {
      const recordA = await recordModel.create({
        artist: 'Order Artist A',
        album: 'Order Album A',
        price: 100,
        qty: 10,
        format: RecordFormat.CD,
        category: RecordCategory.ROCK,
      });

      const recordB = await recordModel.create({
        artist: 'Order Artist B',
        album: 'Order Album B',
        price: 200,
        qty: 5,
        format: RecordFormat.VINYL,
        category: RecordCategory.JAZZ,
      });

      const createDto: CreateOrderRequestDTO = {
        items: [
          { recordId: recordA.id, quantity: 2 },
          { recordId: recordB.id, quantity: 1 },
        ],
      };

      const startTime = performance.now();

      const res = await request(app.getHttpServer())
        .post('/orders')
        .send(createDto)
        .expect(201);

      const endTime = performance.now();
      const duration = endTime - startTime;
      console.log(`[E2E Test] /orders POST request took ${duration} ms.`);

      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('items');
      expect(res.body).toHaveProperty('totalAmount');

      expect(Array.isArray(res.body.items)).toBe(true);
      expect(res.body.items).toHaveLength(2);

      const expectedTotal = 2 * recordA.price + 1 * recordB.price;
      expect(res.body.totalAmount).toBe(expectedTotal);

      const itemForA = res.body.items.find((i) => i.record.id === recordA.id);
      const itemForB = res.body.items.find((i) => i.record.id === recordB.id);

      expect(itemForA).toBeDefined();
      expect(itemForA.quantity).toBe(2);
      expect(itemForA.priceAtTime).toBe(recordA.price);

      expect(itemForB).toBeDefined();
      expect(itemForB.quantity).toBe(1);
      expect(itemForB.priceAtTime).toBe(recordB.price);

      const savedOrder = await orderModel.findById(res.body.id).lean();
      expect(savedOrder).toBeDefined();
      expect(savedOrder.totalAmount).toBe(expectedTotal);
      expect(savedOrder.items).toHaveLength(2);

      const updatedRecordA = await recordModel.findById(recordA.id).lean();
      const updatedRecordB = await recordModel.findById(recordB.id).lean();

      expect(updatedRecordA.qty).toBe(10 - 2);
      expect(updatedRecordB.qty).toBe(5 - 1);
    });

    it('should reject invalid order payload with 400 (validation)', async () => {
      const record = await recordModel.create({
        artist: 'Validation Artist',
        album: 'Validation Album',
        price: 50,
        qty: 10,
        format: RecordFormat.CD,
        category: RecordCategory.ROCK,
      });

      const invalidPayload = {
        items: [
          {
            recordId: 'not-a-valid-mongo-id',
            quantity: 0,
          },
          {
            recordId: record.id,
            quantity: -1,
          },
        ],
      };

      const res = await request(app.getHttpServer())
        .post('/orders')
        .send(invalidPayload)
        .expect(400);

      expect(res.body.message).toBeDefined();
      expect(Array.isArray(res.body.message)).toBe(true);
      // Sanity: at least one error mentions quantity or recordId
      expect(res.body.message.join(' ').toLowerCase()).toContain('quantity');
    });

    it('should return 404 when any record in the order does not exist', async () => {
      const existingRecord = await recordModel.create({
        artist: 'Existing Artist',
        album: 'Existing Album',
        price: 40,
        qty: 10,
        format: RecordFormat.VINYL,
        category: RecordCategory.ROCK,
      });

      const dto: CreateOrderRequestDTO = {
        items: [
          { recordId: existingRecord.id, quantity: 1 },
          { recordId: '64b6f7a36e5c5e0012345678', quantity: 1 }, // non-existent but valid ObjectId
        ],
      };

      const res = await request(app.getHttpServer())
        .post('/orders')
        .send(dto)
        .expect(404);

      expect((res.body.message ?? '').toLowerCase()).toMatch(/not found/);

      // Ensure no order was created
      const orderCount = await orderModel.countDocuments({});
      expect(orderCount).toBe(0);

      const refreshedRecord = await recordModel
        .findById(existingRecord.id)
        .lean();
      // Stock should not be decremented because transaction is aborted
      expect(refreshedRecord.qty).toBe(existingRecord.qty);
    });

    it('should return 409 when stock is insufficient for any item', async () => {
      const record = await recordModel.create({
        artist: 'Low Stock Artist',
        album: 'Low Stock Album',
        price: 100,
        qty: 2,
        format: RecordFormat.CD,
        category: RecordCategory.ROCK,
      });

      const dto: CreateOrderRequestDTO = {
        items: [{ recordId: record.id, quantity: 5 }],
      };

      const res = await request(app.getHttpServer())
        .post('/orders')
        .send(dto)
        .expect(409);

      expect((res.body.message ?? '').toLowerCase()).toContain(
        'insufficient stock',
      );

      const orders = await orderModel.find({}).lean();
      expect(orders.length).toBe(0);

      const refreshedRecord = await recordModel.findById(record.id).lean();
      expect(refreshedRecord.qty).toBe(2); // unchanged
    });

    it('should not oversell stock when multiple concurrent orders target the same record', async () => {
      const initialQty = 3;

      const record = await recordModel.create({
        artist: 'Concurrent Artist',
        album: 'Concurrent Album',
        price: 50,
        qty: initialQty,
        format: RecordFormat.VINYL,
        category: RecordCategory.ROCK,
      });

      const dto: CreateOrderRequestDTO = {
        items: [{ recordId: record.id, quantity: 2 }],
      };

      const httpServer = app.getHttpServer();

      const makeOrderRequest = () =>
        request(httpServer).post('/orders').send(dto);

      const results = await Promise.allSettled([
        makeOrderRequest(),
        makeOrderRequest(),
        makeOrderRequest(),
      ]);

      const fulfilled = results.filter(
        (r): r is PromiseFulfilledResult<request.Response> =>
          r.status === 'fulfilled',
      );

      const successes = fulfilled.filter((r) => r.value.status === 201);
      const transientOrConflict = fulfilled.filter((r) =>
        [409, 503].includes(r.value.status),
      );

      const unexpected = fulfilled.filter(
        (r) => ![201, 409, 503].includes(r.value.status),
      );

      expect(successes.length).toBeLessThanOrEqual(1);
      expect(transientOrConflict.length).toBeGreaterThanOrEqual(1);
      expect(unexpected.length).toBe(0);

      const updatedRecord = await recordModel.findById(record.id).lean();

      expect(updatedRecord.qty).toBeGreaterThanOrEqual(initialQty - 2);
      expect(updatedRecord.qty).toBeLessThanOrEqual(initialQty);

      const orders = await orderModel.find({}).lean();
      expect(orders.length).toBeLessThanOrEqual(1);
      if (orders.length === 1) {
        expect(orders[0].totalAmount).toBe(2 * record.price);
      }
    });
  });
});
