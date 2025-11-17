import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Put,
  ValidationPipe,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateRecordRequestDTO } from '../dtos/create-record.request.dto';
import { UpdateRecordRequestDTO } from '../dtos/update-record.request.dto';
import { RecordService } from '../services/record.service';
import { RecordQueryDto } from '../dtos/record-query.dto';
import { LoggingInterceptor } from '../interceptors/logging.interceptor';
import { RecordResponseDto } from '../dtos/record.response.dto';
import { PaginatedResponseDto } from '../dtos/paginated.response.dto';

class PaginatedRecordResponse extends PaginatedResponseDto(RecordResponseDto) {}

@ApiTags('records')
@Controller('records')
export class RecordController {
  constructor(private readonly recordService: RecordService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new record' })
  @ApiResponse({
    status: 201,
    description: 'Record successfully created',
    type: RecordResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  create(
    @Body() createRecordDto: CreateRecordRequestDTO,
  ): Promise<RecordResponseDto> {
    return this.recordService.create(createRecordDto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an existing record' })
  @ApiResponse({
    status: 200,
    description: 'Record updated successfully',
    type: RecordResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Record not found' })
  update(
    @Param('id') id: string,
    @Body() updateRecordDto: UpdateRecordRequestDTO,
  ): Promise<RecordResponseDto> {
    return this.recordService.update(id, updateRecordDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all records with optional filters' })
  @ApiResponse({ status: 200, type: PaginatedResponseDto(RecordResponseDto) })
  @UseInterceptors(LoggingInterceptor)
  findAll(
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    query: RecordQueryDto,
  ): Promise<PaginatedRecordResponse> {
    return this.recordService.findAll(query);
  }
}
