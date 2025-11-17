import { Type } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from './pagination.dto';

/**
 * A factory function that creates a generic PaginatedResponseDto class.
 * @param TClass The class of the data items.
 */
export function PaginatedResponseDto<TClass extends Type<any>>(TClass: TClass) {
  abstract class PaginatedResponse {
    @ApiProperty({ isArray: true, type: TClass })
    data: InstanceType<TClass>[];

    @ApiProperty({ type: () => PaginationMetaDto })
    meta: PaginationMetaDto;
  }
  return PaginatedResponse;
}
