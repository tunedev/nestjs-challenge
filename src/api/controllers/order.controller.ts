import {
  Body,
  Controller,
  Post,
  UsePipes,
  ValidationPipe,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { OrderService } from '../services/order.service';
import { CreateOrderRequestDTO } from '../dtos/create-order.request.dto';
import { OrderResponseDto } from '../dtos/order.response.dto';
import { LoggingInterceptor } from '../interceptors/logging.interceptor';

@ApiTags('orders')
@Controller('orders')
@UseInterceptors(LoggingInterceptor)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new order',
    description:
      'Creates an order for one or more records, decrements stock atomically, and returns the populated order.',
  })
  @ApiBody({
    description: 'Payload describing the items to be ordered.',
    type: CreateOrderRequestDTO,
  })
  @ApiResponse({
    status: 201,
    description: 'Order successfully created and stock decremented.',
    type: OrderResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad Request – validation failed (e.g., invalid recordId, non-MongoId, or quantity < 1).',
  })
  @ApiResponse({
    status: 404,
    description:
      'Not Found – one or more referenced records could not be found.',
  })
  @ApiResponse({
    status: 409,
    description:
      'Conflict – insufficient stock for one or more records in the order.',
  })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async create(
    @Body() createOrderDto: CreateOrderRequestDTO,
  ): Promise<OrderResponseDto> {
    return this.orderService.create(createOrderDto);
  }
}
