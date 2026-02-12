const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME || 'accordo',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASS || 'postgres',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false,
  }
);

async function checkEnums() {
  try {
    await sequelize.authenticate();
    console.log('Connected to database');

    // Check currency enum values
    const [currencyResult] = await sequelize.query(`
      SELECT enum_range(NULL::\"enum_Requisitions_typeOfCurrency\") as values;
    `);
    console.log('Currency enum values:', currencyResult[0]?.values);

    // Check if Requisitions table exists and its structure
    const [columns] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'Requisitions'
      ORDER BY ordinal_position;
    `);
    console.log('\nRequisitions table columns:');
    columns.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    // Check for required (NOT NULL) columns
    console.log('\nRequired (NOT NULL) columns:');
    columns.filter(c => c.is_nullable === 'NO').forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type}`);
    });

    await sequelize.close();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkEnums();
