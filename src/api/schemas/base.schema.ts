import { Prop } from '@nestjs/mongoose';

export abstract class BaseSchema {
  @Prop({ default: Date.now })
  created: Date;

  @Prop({ default: Date.now })
  lastModified: Date;
}
