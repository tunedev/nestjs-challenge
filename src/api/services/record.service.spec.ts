import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NotFoundException } from '@nestjs/common';
import { RecordService } from './record.service';
import { Record, RecordDocument } from '../schemas/record.schema';
import { RecordQueryDto } from '../dtos/record-query.dto';
import { CreateRecordRequestDTO } from '../dtos/create-record.request.dto';
import { RecordCategory, RecordFormat } from '../schemas/record.enum';
import { UpdateRecordRequestDTO } from '../dtos/update-record.request.dto';
import { MusicBrainzService } from './musicbrainz.service';

const mockRecordDocument = (dto: any): any => ({
  ...dto,
  _id: 'some-id',
  populate: jest.fn().mockReturnThis(),
  toJSON: jest.fn().mockReturnValue({ id: 'some-id', ...dto }),
});
describe('RecordService', () => {
  let service: RecordService;
  let model: Model<RecordDocument>;

  const mockRecord = {
    artist: 'Test Artist',
    album: 'Test Album',
    price: 10,
    qty: 5,
    format: RecordFormat.VINYL,
    category: RecordCategory.ROCK,
  };

  const mockRecordInstance = mockRecordDocument(mockRecord);

  const mockRecordModel = {
    findOneAndUpdate: jest.fn().mockResolvedValue(mockRecordInstance),
    findById: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(mockRecordInstance),
    }),
    findByIdAndDelete: jest.fn().mockResolvedValue(mockRecordInstance),
    find: jest.fn().mockReturnValue({
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([mockRecordInstance]),
    }),
    countDocuments: jest
      .fn()
      .mockReturnValue({ exec: jest.fn().mockResolvedValue(1) }),
  };

  const mockMusicBrainzService = {
    findOrCreateFromMBID: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecordService,
        {
          provide: getModelToken(Record.name),
          useValue: mockRecordModel,
        },
        {
          provide: MusicBrainzService,
          useValue: mockMusicBrainzService,
        },
      ],
    }).compile();

    service = module.get<RecordService>(RecordService);
    model = module.get<Model<RecordDocument>>(getModelToken(Record.name));

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create and save a new record', async () => {
      const createDto: CreateRecordRequestDTO = mockRecord;
      await service.create(createDto);

      expect(model.findOneAndUpdate).toHaveBeenCalledWith(
        {
          artist: createDto.artist,
          album: createDto.album,
          format: createDto.format,
        },
        { $set: createDto },
        { new: true, upsert: true, runValidators: true },
      );
    });
  });

  describe('update', () => {
    it('should update an existing record', async () => {
      const updateDto: UpdateRecordRequestDTO = { price: 15 };
      const recordId = 'some-id';

      await service.update(recordId, updateDto);

      expect(model.findById).toHaveBeenCalledWith(recordId);
      expect(model.findOneAndUpdate).toHaveBeenCalledWith(
        expect.any(Object),
        { $set: updateDto },
        expect.any(Object),
      );
    });

    it('should throw NotFoundException if record to update is not found', async () => {
      (model.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.update('bad-id', {})).rejects.toThrow(
        NotFoundException,
      );
      expect(model.findById).toHaveBeenCalledWith('bad-id');
    });
  });

  describe('findAll', () => {
    it('should return a paginated list of records', async () => {
      const query: RecordQueryDto = { page: 1, limit: 10, q: 'Test' };

      const result = await service.findAll(query);

      expect(model.find).toHaveBeenCalledWith({ $text: { $search: 'Test' } });
      expect(result.data[0]).toEqual(
        expect.objectContaining({ id: 'some-id', ...mockRecord }),
      );
      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        totalItems: 1,
        totalPages: 1,
      });
    });
  });
});
