import logger from "../src/config/logger.js";
import { connectDatabase } from "../src/config/database.js";
import seedAll from "../src/seeders/index.js";
import sequelize from "../src/config/database.js";

const parseList = (value) => {
  if (!value) return undefined;
  return value.split(",").map((item) => item.trim()).filter(Boolean);
};

(async () => {
  try {
    await connectDatabase();
    const only = parseList(process.env.SEED_ONLY);
    const skip = parseList(process.env.SEED_SKIP);

    await seedAll({ only, skip });
    logger.info("Seeders executed successfully");
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    logger.error("Seeding failed", error);
    await sequelize.close();
    process.exit(1);
  }
})();
