import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';
import { RecordFormat, RecordCategory } from './record.enum';
import { Track } from './track.schema';
import { BaseSchema } from './base.schema';

export type RecordDocument = HydratedDocument<Record>;

@Schema({ collection: 'records' })
export class Record extends BaseSchema {
  @Prop({ required: true })
  artist: string;

  @Prop({ required: true })
  album: string;

  @Prop({ required: true })
  price: number;

  @Prop({ required: true })
  qty: number;

  @Prop({ enum: RecordFormat, required: true })
  format: RecordFormat;

  @Prop({ enum: RecordCategory, required: true })
  category: RecordCategory;

  @Prop({ required: false })
  mbid?: string;

  tracklist: Track[];
}

export const RecordSchema = SchemaFactory.createForClass(Record);

RecordSchema.virtual('tracklist', {
  ref: 'MusicBrainzRecord',
  localField: 'mbid',
  foreignField: '_id',
  justOne: true,
  transform: (doc) => {
    return doc ? doc.tracklist : null;
  },
});

RecordSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    if (ret.tracklist && Array.isArray(ret.tracklist.tracklist)) {
      ret.tracklist = ret.tracklist.tracklist;
    } else if (ret.tracklist && !Array.isArray(ret.tracklist)) {
      ret.tracklist = [];
    }

    delete ret._id;
  },
});

RecordSchema.index({ artist: 'text', album: 'text' }, { name: 'text_search' });
RecordSchema.index({ artist: 1 });
RecordSchema.index({ album: 1 });
RecordSchema.index({ category: 1 });
RecordSchema.index({ format: 1 });

RecordSchema.index(
  { artist: 1, album: 1, format: 1 },
  { unique: true, name: 'record_uniqueness_idx' },
);
