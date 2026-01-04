import logger from '../src/config/logger.js';
import { connectDatabase } from '../src/config/database.js';
import seedAll from '../src/seeders/index.js';
import sequelize from '../src/config/database.js';

interface SeedOptions {
  only?: string[];
  skip?: string[];
}

const parseList = (value: string | undefined): string[] | undefined => {
  if (!value) return undefined;
  return value.split(',').map((item) => item.trim()).filter(Boolean);
};

(async (): Promise<void> => {
  try {
    await connectDatabase();
    const only = parseList(process.env.SEED_ONLY);
    const skip = parseList(process.env.SEED_SKIP);

    const options: SeedOptions = { only, skip };
    await seedAll(options);

    logger.info('Seeders executed successfully');
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    logger.error('Seeding failed', error);
    await sequelize.close();
    process.exit(1);
  }
})();
