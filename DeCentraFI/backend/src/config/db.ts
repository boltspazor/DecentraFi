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
    await client.query(`
      CREATE TABLE IF NOT EXISTS contributions (
        id SERIAL PRIMARY KEY,
        campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        contributor_address VARCHAR(42) NOT NULL,
        amount_wei VARCHAR(78) NOT NULL,
        tx_hash VARCHAR(66) NOT NULL UNIQUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_contributions_campaign_id ON contributions(campaign_id);`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_contributions_tx_hash ON contributions(tx_hash);`);

    const alterQueries = [
      `ALTER TABLE campaigns ADD COLUMN total_raised VARCHAR(78) DEFAULT '0'`,
      `ALTER TABLE campaigns ADD COLUMN status VARCHAR(20) DEFAULT 'Active'`,
    ];
    for (const q of alterQueries) {
      try {
        await client.query(q);
      } catch (e: unknown) {
        const err = e as { code?: string };
        if (err.code !== "42701") throw e;
      }
    }
  } finally {
    client.release();
  }
}
