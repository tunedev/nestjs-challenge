import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Track, TrackSchema } from './track.schema';
import { BaseSchema } from './base.schema';

export type MusicBrainzRecordDocument = HydratedDocument<MusicBrainzRecord>;

@Schema({ timestamps: true, collection: 'musicbrainz_records' })
export class MusicBrainzRecord extends BaseSchema {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: [TrackSchema], default: [] })
  tracklist: Track[];
}

export const MusicBrainzRecordSchema =
  SchemaFactory.createForClass(MusicBrainzRecord);
