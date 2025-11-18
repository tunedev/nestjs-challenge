import {
  IsArray,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class OrderItemDTO {
  @ApiProperty({
    description:
      'The MongoDB ObjectId of the record being ordered. Must reference an existing Record document.',
    example: '605c72ef9b8d9b001f2e8e4a',
    type: String,
  })
  @IsNotEmpty()
  @IsMongoId()
  recordId: string;

  @ApiProperty({
    description: 'The quantity of this record to purchase. Must be at least 1.',
    example: 2,
    type: Number,
    minimum: 1,
  })
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateOrderRequestDTO {
  @ApiProperty({
    description: 'List of items included in the order.',
    type: [OrderItemDTO],
    example: [
      {
        recordId: '605c72ef9b8d9b001f2e8e4a',
        quantity: 2,
      },
      {
        recordId: '605c72ef9b8d9b001f2e8e4b',
        quantity: 1,
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDTO)
  items: OrderItemDTO[];
}
