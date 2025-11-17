import * as mongoose from 'mongoose';
import { Record, RecordSchema } from './src/api/schemas/record.schema';
import { AppConfig } from './src/app.config';
import { RecordCategory, RecordFormat } from './src/api/schemas/record.enum';

async function seedDatabase() {
  const args = process.argv.slice(2);
  const { faker } = await import('@faker-js/faker');

  if (args.length < 2) {
    console.error(
      'Usage: npm run seed <model_name> <number_of_records_to_generate>',
    );
    console.error('Example: npm run seed Record 100000');
    process.exit(1);
  }

  const modelName = args[0];
  const count = parseInt(args[1], 10);

  if (modelName !== 'Record') {
    console.error(
      `Invalid model name: ${modelName}. Only "Record" is supported.`,
    );
    process.exit(1);
  }

  if (isNaN(count) || count <= 0) {
    console.error('Number of records must be a positive integer.');
    process.exit(1);
  }

  try {
    await mongoose.connect(AppConfig.mongoUrl);
    console.log('Connected to the database.');

    const RecordModel = mongoose.model<Record>('Record', RecordSchema);

    console.log(`Generating and inserting ${count} records...`);

    const batchSize = 1000;
    let insertedCount = 0;

    for (let i = 0; i < count; i += batchSize) {
      const batchCount = Math.min(batchSize, count - i);
      const recordsToInsert = [];

      for (let j = 0; j < batchCount; j++) {
        const categoryValues = Object.values(RecordCategory);
        const formatValues = Object.values(RecordFormat);

        const record = {
          artist: faker.music.artist(),
          album: faker.music.songName(),
          price: faker.commerce.price({ min: 5, max: 50, dec: 2 }),
          qty: faker.number.int({ min: 1, max: 100 }),
          format: faker.helpers.arrayElement(formatValues),
          category: faker.helpers.arrayElement(categoryValues),
          mbid: faker.string.uuid(),
        };
        recordsToInsert.push(record);
      }

      await RecordModel.insertMany(recordsToInsert);
      insertedCount += recordsToInsert.length;
      process.stdout.write(`Inserted ${insertedCount} / ${count} records\r`);
    }

    console.log(`\nSuccessfully inserted ${insertedCount} records!`);
  } catch (error) {
    console.error('Error seeding the database:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from the database.');
  }
}

seedDatabase();

declare module '@faker-js/faker' {
  namespace faker {
    interface Music {
      artist(): string;
    }
  }
}
