import { ApiProperty } from '@nestjs/swagger';
import { RecordCategory, RecordFormat } from '../schemas/record.enum';

export class RecordResponseDto {
  @ApiProperty({
    description: 'The unique identifier of the record',
    example: '605c72ef9b8d9b001f2e8e4a',
  })
  id: string;

  @ApiProperty({
    description: 'The name of the artist',
    example: 'The Beatles',
  })
  artist: string;

  @ApiProperty({ description: 'The title of the album', example: 'Abbey Road' })
  album: string;

  @ApiProperty({ description: 'The price of the record', example: 25.99 })
  price: number;

  @ApiProperty({ description: 'The quantity in stock', example: 10 })
  qty: number;

  @ApiProperty({
    description: 'The format of the record',
    enum: RecordFormat,
    example: RecordFormat.VINYL,
  })
  format: RecordFormat;

  @ApiProperty({
    description: 'The genre or category of the record',
    enum: RecordCategory,
    example: RecordCategory.ROCK,
  })
  category: RecordCategory;

  @ApiProperty({
    description: 'MusicBrainz Identifier for the release',
    required: false,
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  mbid?: string;

  @ApiProperty({
    description: 'The date and time the record was created',
    example: '2023-01-01T12:00:00.000Z',
  })
  created: Date;

  @ApiProperty({
    description: 'The date and time the record was last updated',
    example: '2023-01-01T12:30:00.000Z',
  })
  lastModified: Date;
}
