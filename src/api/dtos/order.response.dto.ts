import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { RecordResponseDto } from './record.response.dto';

export class OrderItemResponseDto {
  @ApiProperty({
    description: 'The record associated with this order item',
    type: () => RecordResponseDto,
  })
  @Type(() => RecordResponseDto)
  record: RecordResponseDto;

  @ApiProperty({
    description: 'Number of units of this record ordered',
    example: 2,
  })
  quantity: number;

  @ApiProperty({
    description: 'Unit price of the record at the time of ordering',
    example: 29.99,
  })
  priceAtTime: number;
}

export class OrderResponseDto {
  @ApiProperty({
    description: 'The unique identifier of the order',
    example: '605c72ef9b8d9b001f2e8e4a',
  })
  id: string;

  @ApiProperty({
    description: 'The line items included in this order',
    type: () => [OrderItemResponseDto],
  })
  @Type(() => OrderItemResponseDto)
  items: OrderItemResponseDto[];

  @ApiProperty({
    description: 'Total monetary amount of the order',
    example: 59.98,
  })
  totalAmount: number;

  @ApiProperty({
    description: 'The date and time the order was created',
    example: '2023-01-01T12:00:00.000Z',
  })
  created: Date;

  @ApiProperty({
    description: 'The date and time the order was last updated',
    example: '2023-01-01T12:30:00.000Z',
  })
  lastModified: Date;
}
