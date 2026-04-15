const { Pool } = require('pg');
require('dotenv').config({ path: 'c:/programasD/Entregas/backend/.env' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    console.log('Attempting to create postgis extension...');
    await pool.query('CREATE EXTENSION IF NOT EXISTS postgis;');
    console.log('Successfully created postgis extension!');
  } catch (err) {
    console.error('FAILED to create postgis extension:');
    console.error(err.message);
  } finally {
    pool.end();
  }
}

run();
