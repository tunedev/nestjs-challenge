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
import { OrderItem, OrderItemSchema } from './schemas/order-item.schema';
import { Order, OrderSchema } from './schemas/order.schema';
import { OrderController } from './controllers/order.controller';
import { OrderService } from './services/order.service';

@Module({
  imports: [
    HttpModule,
    MongooseModule.forFeature([
      { name: Record.name, schema: RecordSchema },
      { name: MusicBrainzRecord.name, schema: MusicBrainzRecordSchema },
      { name: OrderItem.name, schema: OrderItemSchema },
      { name: Order.name, schema: OrderSchema },
    ]),
  ],
  controllers: [RecordController, OrderController],
  providers: [RecordService, MusicBrainzService, OrderService],
})
export class RecordModule {}
