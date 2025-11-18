import { Test, TestingModule } from '@nestjs/testing';
import { OrderController } from './order.controller';
import { OrderService } from '../services/order.service';
import { CreateOrderRequestDTO } from '../dtos/create-order.request.dto';
import { OrderResponseDto } from '../dtos/order.response.dto';
import { ConflictException } from '@nestjs/common';

describe('OrderController', () => {
  let controller: OrderController;
  let orderService: OrderService;

  const mockOrderService = {
    create: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrderController],
      providers: [
        {
          provide: OrderService,
          useValue: mockOrderService,
        },
      ],
    }).compile();

    controller = module.get<OrderController>(OrderController);
    orderService = module.get<OrderService>(OrderService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    const createDto: CreateOrderRequestDTO = {
      items: [{ recordId: 'some-record-id', quantity: 1 }],
    };

    const expectedResponse: OrderResponseDto = {
      id: 'some-order-id',
      items: [],
      totalAmount: 10,
      created: new Date(),
      lastModified: new Date(),
    };

    it('should call OrderService.create with the correct DTO and return the result', async () => {
      mockOrderService.create.mockResolvedValue(expectedResponse);

      const result = await controller.create(createDto);

      expect(orderService.create).toHaveBeenCalledWith(createDto);
      expect(result).toEqual(expectedResponse);
    });

    it('should propagate errors from the service layer', async () => {
      const error = new ConflictException('Insufficient stock');
      mockOrderService.create.mockRejectedValue(error);

      await expect(controller.create(createDto)).rejects.toThrow(
        ConflictException,
      );
      expect(orderService.create).toHaveBeenCalledWith(createDto);
    });
  });
});
