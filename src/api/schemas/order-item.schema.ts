import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, type HydratedDocument } from 'mongoose';
import { Record, RecordDocument } from './record.schema';

export type OrderItemDocument = HydratedDocument<OrderItem>;

@Schema({ _id: false })
export class OrderItem {
  @Prop({ ref: Record.name, type: Types.ObjectId, required: true })
  record: Types.ObjectId | RecordDocument;

  @Prop({ required: true, min: 1 })
  quantity: number;

  @Prop({ required: true })
  priceAtTime: number;
}

export const OrderItemSchema = SchemaFactory.createForClass(OrderItem);
