import pg from "pg";

const { Pool } = pg;

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://localhost:5432/decentrafi";

export const pool = new Pool({ connectionString });

export async function connectDb(): Promise<void> {
  const client = await pool.connect();
  try {
    // For existing DBs missing UNIQUE on campaign_address, run:
    // ALTER TABLE campaigns ADD CONSTRAINT campaigns_campaign_address_key UNIQUE (campaign_address);
    await client.query(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        goal VARCHAR(78) NOT NULL,
        deadline TIMESTAMPTZ NOT NULL,
        creator VARCHAR(42) NOT NULL,
        campaign_address VARCHAR(42) NOT NULL UNIQUE,
        tx_hash VARCHAR(66),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  } finally {
    client.release();
  }
}
