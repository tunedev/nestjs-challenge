import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RecordDocument } from '../src/api/schemas/record.schema';
import { CreateRecordRequestDTO } from '../src/api/dtos/create-record.request.dto';
import { UpdateRecordRequestDTO } from '../src/api/dtos/update-record.request.dto';
import { RecordCategory, RecordFormat } from '../src/api/schemas/record.enum';
import { MusicBrainzRecordDocument } from '../src/api/schemas/musicbrainz-record.schema';

describe('RecordController (e2e)', () => {
  let app: INestApplication;
  let recordModel: Model<RecordDocument>;
  let mbidModel: Model<MusicBrainzRecordDocument>;

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
      getModelToken('Record'),
    );
    mbidModel = moduleFixture.get<Model<MusicBrainzRecordDocument>>(
      getModelToken('MusicBrainzRecord'),
    );
  });

  afterEach(async () => {
    await recordModel.deleteMany({});
    await mbidModel.deleteMany({});
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/records (POST)', () => {
    it('should create a new record (no mbid)', async () => {
      const createDto: CreateRecordRequestDTO = {
        artist: 'E2E Test Artist',
        album: 'E2E Test Album',
        price: 19.99,
        qty: 50,
        format: RecordFormat.CD,
        category: RecordCategory.JAZZ,
      };

      const response = await request(app.getHttpServer())
        .post('/records')
        .send(createDto)
        .expect(201);

      expect(response.body).toEqual({
        id: expect.any(String),
        artist: createDto.artist,
        album: createDto.album,
        price: createDto.price,
        qty: createDto.qty,
        format: createDto.format,
        category: createDto.category,
        created: expect.any(String),
        lastModified: expect.any(String),
        tracklist: null,
      });

      const storedRecord = await await recordModel
        .findOne({
          artist: createDto.artist,
          album: createDto.album,
          format: createDto.format,
        })
        .exec();
      expect(storedRecord).toBeDefined();
      expect(storedRecord).not.toBeNull();
      expect(storedRecord.artist).toBe(createDto.artist);
      expect(storedRecord.mbid).toBeUndefined();
    });

    it('should create a new record and associated mbid data', async () => {
      const createDto: CreateRecordRequestDTO = {
        artist: 'Jason Henn',
        album: 'The Parachute Candidate',
        price: 30,
        qty: 50,
        format: RecordFormat.CASSETTE,
        category: RecordCategory.POP,
        mbid: '561b17b2-a511-4ab6-8ac8-d3eae81f4544',
      };

      const response = await request(app.getHttpServer())
        .post('/records')
        .send(createDto)
        .expect(201);

      const mbidRecord = await mbidModel.findById(createDto.mbid).lean();
      expect(mbidRecord).toBeDefined();
      expect(Array.isArray(mbidRecord.tracklist)).toBe(true);
      expect(mbidRecord.tracklist.length).toBeGreaterThan(0);

      expect(Array.isArray(response.body.tracklist)).toBe(true);
      expect(response.body.tracklist).toEqual(mbidRecord.tracklist);
      expect(response.body).toMatchObject({
        id: expect.any(String),
        artist: createDto.artist,
        album: createDto.album,
        price: createDto.price,
        qty: createDto.qty,
        format: createDto.format,
        category: createDto.category,
      });
    });

    it('should reject invalid record payload with 400 (validation)', async () => {
      const invalidPayload = {
        artist: '',
        price: 'not-a-number',
      };
      const response = await request(app.getHttpServer())
        .post('/records')
        .send(invalidPayload)
        .expect(400);

      expect(response.body.message).toBeDefined();
      expect(Array.isArray(response.body.message)).toBe(true);
    });

    it('should upsert duplicate records with same artist+album+format', async () => {
      const payload: CreateRecordRequestDTO = {
        artist: 'Duplicate Artist',
        album: 'Duplicate Album',
        price: 15.0,
        qty: 5,
        format: RecordFormat.CD,
        category: RecordCategory.ROCK,
      };

      const initialRes = await request(app.getHttpServer())
        .post('/records')
        .send(payload)
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/records')
        .send({ ...payload, category: RecordCategory.ALTERNATIVE })
        .expect(201);

      expect(res.body.id).toEqual(initialRes.body.id);

      const actualRecord = await recordModel.findById(res.body.id).lean();
      expect(actualRecord.category).toBe(res.body.category);
    });
  });

  describe('/records (GET)', () => {
    it('should match the paginated structure', async () => {
      const startTime = performance.now();

      const response = await request(app.getHttpServer())
        .get('/records')
        .expect(200);

      const endTime = performance.now();
      const duration = endTime - startTime;

      console.log(`[E2E Test] /records GET request took ${duration} ms.`);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
      expect(response.body.meta.totalItems).toBe(0);
    });

    it('should return paginated records with tracklists when present', async () => {
      const mbid = '4a22139f-e8cf-4993-b71a-e8823a87278a';

      await mbidModel.create({
        _id: mbid,
        tracklist: [
          { position: 1, title: 'Delta Pisces' },
          { position: 2, title: 'The Parachute Candidate' },
        ],
      });

      await Promise.all(
        [
          {
            artist: 'Artist 1',
            album: 'Album 1',
            price: 10,
            qty: 5,
            format: RecordFormat.CD,
            category: RecordCategory.ROCK,
            mbid,
          },
          {
            artist: 'Artist 2',
            album: 'Album 2',
            price: 20,
            qty: 3,
            format: RecordFormat.VINYL,
            category: RecordCategory.JAZZ,
          },
        ].map((item) =>
          request(app.getHttpServer()).post('/records').send(item),
        ),
      );

      const res = await request(app.getHttpServer())
        .get('/records?page=1&limit=10')
        .expect(200);

      expect(res.body.meta.totalItems).toBe(2);
      expect(res.body.data.length).toBe(2);

      const [withTracklist] = res.body.data.filter(
        (r) => r.artist === 'Artist 1',
      );
      const [withoutTracklist] = res.body.data.filter(
        (r) => r.artist === 'Artist 2',
      );

      expect(Array.isArray(withTracklist.tracklist)).toBe(true);
      expect(withTracklist.tracklist).toEqual([
        { position: 1, title: 'Delta Pisces' },
        { position: 2, title: 'The Parachute Candidate' },
      ]);

      expect(withoutTracklist.tracklist).toBeNull();
    });
  });

  describe('/records/:id (PUT)', () => {
    it('should update a record quickly and return the updated document', async () => {
      const initialRecord = (
        await request(app.getHttpServer()).post('/records').send({
          artist: 'Update test Artist',
          album: 'test Album',
          price: 25.5,
          qty: 10,
          format: RecordFormat.VINYL,
          category: RecordCategory.ROCK,
        })
      ).body;

      const updateDto: UpdateRecordRequestDTO = {
        price: 29.99,
        qty: 8,
      };

      const startTime = performance.now();

      const response = await request(app.getHttpServer())
        .put(`/records/${initialRecord.id}`)
        .send(updateDto)
        .expect(200);

      const endTime = performance.now();
      const duration = endTime - startTime;
      console.log(`[E2E Test] /records/:id PUT request took ${duration} ms.`);

      expect(duration).toBeLessThan(50);

      expect(response.body).toEqual({
        id: initialRecord.id,
        artist: initialRecord.artist,
        album: initialRecord.album,
        price: updateDto.price,
        qty: updateDto.qty,
        format: initialRecord.format,
        category: initialRecord.category,
        created: expect.any(String),
        lastModified: expect.any(String),
        tracklist: null,
      });
    });

    it('should return 404 when updating a non-existing record', async () => {
      const nonExistingId = '64b6f7a36e5c5e0012345678';

      const res = await request(app.getHttpServer())
        .put(`/records/${nonExistingId}`)
        .send({ price: 99.99 })
        .expect(404);

      expect(res.body.message ?? '').toMatch(/not found/i);
    });
  });
});
