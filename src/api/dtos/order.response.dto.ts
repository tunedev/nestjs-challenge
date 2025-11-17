import { Expose, Type } from 'class-transformer';
import { RecordResponseDto } from './record.response.dto';

class OrderItemResponseDto {
  @Expose()
  @Type(() => RecordResponseDto)
  record: RecordResponseDto;

  @Expose()
  quantity: number;

  @Expose()
  priceAtTime: number;
}

export class OrderResponseDto {
  @Expose()
  id: string;

  @Expose()
  @Type(() => OrderItemResponseDto)
  items: OrderItemResponseDto[];

  @Expose()
  totalAmount: number;
}
