import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConflictException, NotFoundException } from '@nestjs/common';

import { OrderService } from './order.service';
import { Record } from '../schemas/record.schema';
import { Order } from '../schemas/order.schema';
import { CreateOrderRequestDTO } from '../dtos/create-order.request.dto';
import { OrderResponseDto } from '../dtos/order.response.dto';

describe('OrderService', () => {
  let service: OrderService;

  let recordModel: jest.Mocked<any>;
  let orderModel: jest.Mocked<any>;
  let connection: jest.Mocked<any>;

  const mockSession = {
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    abortTransaction: jest.fn(),
    endSession: jest.fn(),
  };

  beforeEach(async () => {
    connection = {
      startSession: jest.fn().mockResolvedValue(mockSession),
    };

    recordModel = {
      find: jest.fn(),
    };
    const mockOrderModelCtor = jest.fn();
    orderModel = mockOrderModelCtor;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        {
          provide: getModelToken(Record.name),
          useValue: recordModel,
        },
        {
          provide: getModelToken(Order.name),
          useValue: mockOrderModelCtor,
        },
        {
          provide: 'DatabaseConnection',
          useValue: connection,
        },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);

    jest.clearAllMocks();
    mockSession.startTransaction.mockClear();
    mockSession.commitTransaction.mockClear();
    mockSession.abortTransaction.mockClear();
    mockSession.endSession.mockClear();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create an order, decrement stock, and commit transaction (happy path with multiple items)', async () => {
      const recordId1 = 'rec1';
      const recordId2 = 'rec2';

      const recordDoc1 = {
        _id: recordId1,
        album: 'Album 1',
        qty: 10,
        price: 100,
        save: jest.fn().mockResolvedValue(true),
      };

      const recordDoc2 = {
        _id: recordId2,
        album: 'Album 2',
        qty: 5,
        price: 200,
        save: jest.fn().mockResolvedValue(true),
      };

      (recordModel.find as jest.Mock).mockReturnValueOnce({
        session: jest.fn().mockResolvedValue([recordDoc1, recordDoc2]),
      });

      const populateMock = jest.fn().mockResolvedValue({
        toJSON: () => ({
          id: 'order123',
          items: [
            {
              record: { ...recordDoc1, id: recordId1 },
              quantity: 2,
              priceAtTime: 100,
            },
            {
              record: { ...recordDoc2, id: recordId2 },
              quantity: 1,
              priceAtTime: 200,
            },
          ],
          totalAmount: 400,
        }),
      });

      const orderSaveMock = jest.fn().mockResolvedValue({
        id: 'order123',
        populate: populateMock,
      });

      (orderModel as jest.Mock).mockImplementation((doc: any) => ({
        ...doc,
        save: orderSaveMock,
      }));

      const dto: CreateOrderRequestDTO = {
        items: [
          { recordId: recordId1, quantity: 2 },
          { recordId: recordId2, quantity: 1 },
        ],
      } as any;

      const result = await service.create(dto);

      // Transaction flow
      expect(connection.startSession).toHaveBeenCalled();
      expect(mockSession.startTransaction).toHaveBeenCalled();
      expect(mockSession.commitTransaction).toHaveBeenCalled();
      expect(mockSession.abortTransaction).not.toHaveBeenCalled();
      expect(mockSession.endSession).toHaveBeenCalled();

      expect(recordDoc1.qty).toBe(8);
      expect(recordDoc2.qty).toBe(4);
      expect(recordDoc1.save).toHaveBeenCalledWith({ session: mockSession });
      expect(recordDoc2.save).toHaveBeenCalledWith({ session: mockSession });

      expect(orderModel).toHaveBeenCalledWith({
        items: [
          {
            record: recordId1,
            quantity: 2,
            priceAtTime: 100,
          },
          {
            record: recordId2,
            quantity: 1,
            priceAtTime: 200,
          },
        ],
        totalAmount: 400,
      });
      expect(orderSaveMock).toHaveBeenCalledWith({ session: mockSession });
      expect(populateMock).toHaveBeenCalledWith('items.record');

      expect(result).toBeInstanceOf(OrderResponseDto);
      expect(result.totalAmount).toBe(400);
      expect(result.items).toHaveLength(2);
      expect(result.items[0].record.id).toBe(recordId1);
      expect(result.items[0].quantity).toBe(2);
      expect(result.items[1].record.id).toBe(recordId2);
      expect(result.items[1].quantity).toBe(1);
    });

    it('should throw NotFoundException and abort transaction when record is not found', async () => {
      const dto: CreateOrderRequestDTO = {
        items: [{ recordId: 'missing', quantity: 1 }],
      } as any;

      (recordModel.find as jest.Mock).mockReturnValue({
        session: jest.fn().mockResolvedValue([]),
      });

      await expect(service.create(dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );

      expect(orderModel).not.toHaveBeenCalled();

      expect(mockSession.startTransaction).toHaveBeenCalled();
      expect(mockSession.abortTransaction).toHaveBeenCalled();
      expect(mockSession.commitTransaction).not.toHaveBeenCalled();
      expect(mockSession.endSession).toHaveBeenCalled();
    });

    it('should throw ConflictException and abort transaction when stock is insufficient', async () => {
      const dto: CreateOrderRequestDTO = {
        items: [{ recordId: 'rec1', quantity: 5 }],
      } as any;

      const recordDoc = {
        _id: 'rec1',
        album: 'Album 1',
        qty: 2,
        price: 100,
        save: jest.fn(),
      };

      (recordModel.find as jest.Mock).mockReturnValue({
        session: jest.fn().mockResolvedValue([recordDoc]),
      });

      await expect(service.create(dto)).rejects.toBeInstanceOf(
        ConflictException,
      );

      expect(recordDoc.save).not.toHaveBeenCalled();
      expect(orderModel).not.toHaveBeenCalled();

      expect(mockSession.startTransaction).toHaveBeenCalled();
      expect(mockSession.abortTransaction).toHaveBeenCalled();
      expect(mockSession.commitTransaction).not.toHaveBeenCalled();
      expect(mockSession.endSession).toHaveBeenCalled();
    });

    it('should abort transaction and rethrow on order save error', async () => {
      const dto: CreateOrderRequestDTO = {
        items: [{ recordId: 'rec1', quantity: 1 }],
      } as any;

      const recordDoc = {
        _id: 'rec1',
        album: 'Album 1',
        qty: 2,
        price: 100,
        save: jest.fn().mockResolvedValue(true),
      };

      (recordModel.find as jest.Mock).mockReturnValue({
        session: jest.fn().mockResolvedValue([recordDoc]),
      });

      const error = new Error('DB save failed');

      const orderSaveMock = jest.fn().mockRejectedValue(error);

      (orderModel as jest.Mock).mockImplementation((doc: any) => ({
        ...doc,
        save: orderSaveMock,
      }));

      await expect(service.create(dto)).rejects.toBe(error);

      expect(recordDoc.qty).toBe(1);
      expect(recordDoc.save).toHaveBeenCalledWith({ session: mockSession });

      expect(orderModel).toHaveBeenCalled();
      expect(orderSaveMock).toHaveBeenCalledWith({ session: mockSession });

      expect(mockSession.startTransaction).toHaveBeenCalled();
      expect(mockSession.abortTransaction).toHaveBeenCalled();
      expect(mockSession.commitTransaction).not.toHaveBeenCalled();
      expect(mockSession.endSession).toHaveBeenCalled();
    });
  });
});
