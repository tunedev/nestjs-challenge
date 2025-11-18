import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, mongo } from 'mongoose';
import { Record, RecordDocument } from '../schemas/record.schema';
import { CreateRecordRequestDTO } from '../dtos/create-record.request.dto';
import { UpdateRecordRequestDTO } from '../dtos/update-record.request.dto';
import { RecordQueryDto } from '../dtos/record-query.dto';
import { PaginatedResponseDto } from '../dtos/paginated.response.dto';
import { plainToInstance } from 'class-transformer';
import { MusicBrainzService } from './musicbrainz.service';
import { RecordResponseDto } from '../dtos/record.response.dto';

@Injectable()
export class RecordService {
  private readonly logger = new Logger(RecordService.name);
  constructor(
    @InjectModel(Record.name)
    private readonly recordModel: Model<RecordDocument>,
    private readonly musicBrainzService: MusicBrainzService,
  ) {}

  async create(dto: CreateRecordRequestDTO): Promise<RecordResponseDto> {
    const uniqueFilter = {
      artist: dto.artist,
      album: dto.album,
      format: dto.format,
    };

    const updatePayload = { ...dto };

    return this.upsertRecord(uniqueFilter, updatePayload);
  }

  async update(
    id: string,
    dto: UpdateRecordRequestDTO,
  ): Promise<RecordResponseDto> {
    const existingRecord = await this.recordModel.findById(id).exec();

    if (!existingRecord) {
      throw new NotFoundException(`Record with ID "${id}" not found`);
    }

    const uniqueFilter = {
      artist: dto.artist ?? existingRecord.artist,
      album: dto.album ?? existingRecord.album,
      format: dto.format ?? existingRecord.format,
    };

    const updatePayload = { ...dto };

    return this.upsertRecord(uniqueFilter, updatePayload, id);
  }

  /**
   * Creates a new record or updates an existing one based on the unique
   * combination of artist, album, and format.
   * @param uniqueFilter The filter to find the unique record.
   * @param payload The data for the record.
   * @param id The ID of the record being explicitly updated, if any.
   * @returns The created or updated record DTO.
   */
  private async upsertRecord(
    uniqueFilter: { artist: string; album: string; format: string },
    payload: CreateRecordRequestDTO | UpdateRecordRequestDTO,
    id: string | null = null,
  ): Promise<RecordResponseDto> {
    const musicBrainzPromise = payload.mbid
      ? this.musicBrainzService.findOrCreateFromMBID(payload.mbid)
      : Promise.resolve(null);

    try {
      const recordUpsertPromise = this.recordModel.findOneAndUpdate(
        uniqueFilter,
        { $set: payload },
        { new: true, upsert: true, runValidators: true },
      );

      const [upsertedRecord] = await Promise.all([
        recordUpsertPromise,
        musicBrainzPromise,
      ]);

      if (id && upsertedRecord._id.toString() !== id) {
        await this.recordModel.findByIdAndDelete(id);
      }

      return plainToInstance(
        RecordResponseDto,
        (await upsertedRecord.populate('tracklist')).toJSON(),
      );
    } catch (error) {
      if (error instanceof mongo.MongoError && error.code === 11000) {
        this.logger.warn(
          `Conflict: A record with different artist/album/format combination already exists.`,
          error.name,
        );
        throw new ConflictException(
          'Update would result in a duplicate record. Please check artist, album, and format.',
        );
      }
      this.logger.error('An unexpected error occurred during upsert.', error);
      throw error;
    }
  }

  async findAll(
    queryDto: RecordQueryDto,
  ): Promise<
    InstanceType<
      ReturnType<typeof PaginatedResponseDto<typeof RecordResponseDto>>
    >
  > {
    const { page, limit, q, ...filters } = queryDto;
    const queryBuildStart = performance.now();
    const filter: FilterQuery<RecordDocument> = {};

    if (q) {
      filter.$text = { $search: q };
    }

    for (const key in filters) {
      if (Object.prototype.hasOwnProperty.call(filters, key)) {
        filter[key] = filters[key];
      }
    }

    const queryBuildEnd = performance.now();
    this.logger.debug(
      `Query building took ${queryBuildEnd - queryBuildStart} ms`,
    );

    const dbQueryStart = performance.now();

    const [results, totalItems] = await Promise.all([
      this.recordModel
        .find(filter)
        .skip((page - 1) * limit)
        .populate('tracklist')
        .limit(limit)
        .exec(),
      this.recordModel.countDocuments(filter).exec(),
    ]);

    const dbQueryEnd = performance.now();
    this.logger.debug(`Database query took ${dbQueryEnd - dbQueryStart} ms`);

    const totalPages = Math.ceil(totalItems / limit);

    return {
      data: results.map((record) =>
        plainToInstance(RecordResponseDto, record.toJSON()),
      ),
      meta: {
        page,
        limit,
        totalItems,
        totalPages,
      },
    };
  }
}
