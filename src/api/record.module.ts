import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RecordController } from './controllers/record.controller';
import { MusicBrainzService } from './services/musicbrainz.service';
import { RecordService } from './services/record.service';
import { Record, RecordSchema } from './schemas/record.schema';
import {
  MusicBrainzRecord,
  MusicBrainzRecordSchema,
} from './schemas/musicbrainz-record.schema';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    HttpModule,
    MongooseModule.forFeature([
      { name: Record.name, schema: RecordSchema },
      { name: MusicBrainzRecord.name, schema: MusicBrainzRecordSchema },
    ]),
  ],
  controllers: [RecordController],
  providers: [RecordService, MusicBrainzService],
})
export class RecordModule {}
