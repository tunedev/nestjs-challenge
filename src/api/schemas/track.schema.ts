import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: false })
export class Track {
  @Prop({ required: true })
  position: number;

  @Prop({ required: true })
  title: string;
}

export const TrackSchema = SchemaFactory.createForClass(Track);
