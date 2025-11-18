import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import mongoose, { Model } from 'mongoose';
import { plainToInstance } from 'class-transformer';

import { Record, RecordDocument } from '../schemas/record.schema';
import { Order, OrderDocument } from '../schemas/order.schema';
import { OrderItem } from '../schemas/order-item.schema';
import { CreateOrderRequestDTO } from '../dtos/create-order.request.dto';
import { OrderResponseDto } from '../dtos/order.response.dto';
import { AppConfig } from '../../app.config';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);
  private readonly MAX_RETRIES = AppConfig.transientRetryMax;

  constructor(
    @InjectModel(Record.name)
    private readonly recordModel: Model<RecordDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectConnection() private readonly connection: mongoose.Connection,
  ) {}

  async create(dto: CreateOrderRequestDTO): Promise<OrderResponseDto> {
    let attempt = 0;

    while (attempt < this.MAX_RETRIES) {
      attempt++;
      const session = await this.connection.startSession();
      session.startTransaction();

      try {
        const recordIds = dto.items.map((item) => item.recordId);
        const records = await this.recordModel
          .find({ _id: { $in: recordIds } })
          .session(session);

        const recordsById = new Map(records.map((r) => [r._id.toString(), r]));

        let totalAmount = 0;
        const orderItems: OrderItem[] = [];

        for (const item of dto.items) {
          const record = recordsById.get(item.recordId);

          if (!record) {
            throw new NotFoundException(
              `Record with ID "${item.recordId}" not found.`,
            );
          }

          if (record.qty < item.quantity) {
            throw new ConflictException(
              `Insufficient stock for record "${record.album}". Only ${record.qty} left.`,
            );
          }

          record.qty -= item.quantity;

          const priceAtTime = record.price;
          totalAmount += priceAtTime * item.quantity;

          orderItems.push({
            record: record._id,
            quantity: item.quantity,
            priceAtTime,
          });
        }

        await Promise.all(records.map((r) => r.save({ session })));

        const newOrder = new this.orderModel({
          items: orderItems,
          totalAmount,
        });
        const savedOrder = await newOrder.save({ session });

        await session.commitTransaction();
        session.endSession();

        this.logger.log(
          `successfully created order ${savedOrder.id} (attempt ${attempt})`,
        );

        const populatedOrder = await savedOrder.populate('items.record');
        return plainToInstance(OrderResponseDto, populatedOrder.toJSON());
      } catch (error) {
        await session.abortTransaction();
        session.endSession();

        if (this.isTransientWriteConflict(error)) {
          this.logger.warn(
            `Transient write conflict while creating order (attempt ${attempt}/${this.MAX_RETRIES}): ${error.message}`,
          );

          if (attempt < this.MAX_RETRIES) {
            continue;
          }

          this.logger.error(
            `Exceeded max retries for transient write conflict, failing with 503`,
          );

          throw new ServiceUnavailableException(
            'Temporary write conflict while processing your order. Please try again shortly.',
          );
        }
        this.logger.error('Failed to create order:', error);
        throw error;
      } finally {
        session.endSession();
      }
    }
  }

  private isTransientWriteConflict(error: any): boolean {
    return (
      error &&
      (error.code === 112 ||
        error.codeName === 'WriteConflict' ||
        (Array.isArray(error.errorLabels) &&
          error.errorLabels.includes('TransientTransactionError')))
    );
  }
}
