import { Test, TestingModule } from '@nestjs/testing';
import { RecordController } from './record.controller';
import { CreateRecordRequestDTO } from '../dtos/create-record.request.dto';
import { UpdateRecordRequestDTO } from '../dtos/update-record.request.dto';
import { RecordCategory, RecordFormat } from '../schemas/record.enum';
import { RecordService } from '../services/record.service';
import { RecordQueryDto } from '../dtos/record-query.dto';
import { RecordResponseDto } from '../dtos/record.response.dto';

describe('RecordController', () => {
  let recordController: RecordController;
  let recordService: RecordService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RecordController],
      providers: [
        {
          provide: RecordService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            update: jest.fn(),
          },
        },
      ],
    }).compile();

    recordController = module.get<RecordController>(RecordController);
    recordService = module.get<RecordService>(RecordService);
  });

  it('should create a new record', async () => {
    const createRecordDto: CreateRecordRequestDTO = {
      artist: 'Test',
      album: 'Test Record',
      price: 100,
      qty: 10,
      format: RecordFormat.VINYL,
      category: RecordCategory.ALTERNATIVE,
    };

    const expectedRecord: RecordResponseDto = {
      id: 'some-id',
      artist: 'Test',
      album: 'Test Record',
      price: 100,
      qty: 10,
      format: RecordFormat.VINYL,
      category: RecordCategory.ALTERNATIVE,
      created: new Date(),
      lastModified: new Date(),
    };

    jest
      .spyOn(recordService, 'create')
      .mockResolvedValue(expectedRecord as any);

    const result = await recordController.create(createRecordDto);
    expect(result).toEqual(expectedRecord);
    expect(recordService.create).toHaveBeenCalledWith(createRecordDto);
  });

  it('should update an existing record', async () => {
    const updateRecordDto: UpdateRecordRequestDTO = { price: 120 };
    const recordId = 'some-id';
    const expectedRecord: RecordResponseDto = {
      id: recordId,
      artist: 'Test',
      album: 'Test Record',
      price: 120,
      qty: 10,
      format: RecordFormat.VINYL,
      category: RecordCategory.ALTERNATIVE,
      created: new Date(),
      lastModified: new Date(),
    };

    jest
      .spyOn(recordService, 'update')
      .mockResolvedValue(expectedRecord as any);

    const result = await recordController.update(recordId, updateRecordDto);
    expect(result).toEqual(expectedRecord);
    expect(recordService.update).toHaveBeenCalledWith(
      recordId,
      updateRecordDto,
    );
  });

  it('should return a paginated list of records', async () => {
    const query: RecordQueryDto = { page: 1, limit: 10 };
    const mockRecords: RecordResponseDto[] = [
      {
        id: 'some-id',
        artist: 'Test Artist',
        album: 'Test Album',
        price: 10,
        qty: 5,
        format: RecordFormat.VINYL,
        category: RecordCategory.ROCK,
        created: new Date(),
        lastModified: new Date(),
      },
    ];
    const expectedResponse = {
      data: mockRecords,
      meta: {
        page: 1,
        limit: 10,
        totalItems: 1,
        totalPages: 1,
      },
    };

    jest
      .spyOn(recordService, 'findAll')
      .mockResolvedValue(expectedResponse as any);

    const result = await recordController.findAll(query);
    expect(result).toEqual(expectedResponse);
    expect(recordService.findAll).toHaveBeenCalledWith(query);
  });
});
