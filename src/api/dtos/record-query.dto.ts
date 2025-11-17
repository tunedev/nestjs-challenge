import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from './pagination.dto';
import { RecordCategory, RecordFormat } from '../schemas/record.enum';

export class RecordQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description:
      'Search query (search across multiple fields like artist and album)',
    type: String,
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    description: 'Filter by artist name',
    type: String,
  })
  @IsOptional()
  @IsString()
  artist?: string;

  @ApiPropertyOptional({
    description: 'Filter by album name',
    type: String,
  })
  @IsOptional()
  @IsString()
  album?: string;

  @ApiPropertyOptional({
    description: 'Filter by record format',
    enum: RecordFormat,
  })
  @IsOptional()
  @IsEnum(RecordFormat)
  format?: RecordFormat;

  @ApiPropertyOptional({
    description: 'Filter by record category',
    enum: RecordCategory,
  })
  @IsOptional()
  @IsEnum(RecordCategory)
  category?: RecordCategory;
}
