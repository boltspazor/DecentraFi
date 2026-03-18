import pg from "pg";

const { Pool } = pg;

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://localhost:5432/decentrafi";

const max = (() => {
  const raw = process.env.DATABASE_MAX_CONNECTIONS;
  if (!raw) return undefined;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? undefined : Math.max(1, Math.min(n, 20));
})();

export const pool = new Pool(
  max !== undefined ? { connectionString, max } : { connectionString }
);

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
        tx_hash VARCHAR(66) NOT NULL,
        chain_id INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_contributions_campaign_id ON contributions(campaign_id);`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_contributions_chain_tx ON contributions(chain_id, tx_hash);`);
    try {
      await client.query(`ALTER TABLE contributions ADD COLUMN chain_id INTEGER NOT NULL DEFAULT 1`);
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err.code !== "42701") throw e;
    }
    try {
      await client.query(`DROP INDEX IF EXISTS idx_contributions_tx_hash`);
    } catch {
      // ignore
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS campaign_chain_addresses (
        campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        chain_id INTEGER NOT NULL,
        campaign_address VARCHAR(42) NOT NULL,
        PRIMARY KEY (campaign_id, chain_id)
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_campaign_chain_addresses_campaign ON campaign_chain_addresses(campaign_id);`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS campaign_reports (
        id SERIAL PRIMARY KEY,
        campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        reporter_wallet VARCHAR(42) NOT NULL,
        reason TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_campaign_reports_campaign_id ON campaign_reports(campaign_id);`);
    try {
      await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_reports_campaign_reporter
        ON campaign_reports(campaign_id, reporter_wallet)
      `);
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err.code !== "42710") throw e;
    }

    const alterQueries = [
      `ALTER TABLE campaigns ADD COLUMN total_raised VARCHAR(78) DEFAULT '0'`,
      `ALTER TABLE campaigns ADD COLUMN status VARCHAR(20) DEFAULT 'Active'`,
      `ALTER TABLE campaigns ADD COLUMN is_verified BOOLEAN DEFAULT FALSE`,
      `ALTER TABLE campaigns ADD COLUMN category VARCHAR(64)`,
    ];
    for (const q of alterQueries) {
      try {
        await client.query(q);
      } catch (e: unknown) {
        const err = e as { code?: string };
        if (err.code !== "42701") throw e;
      }
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS supporter_nfts (
        id SERIAL PRIMARY KEY,
        token_id BIGINT NOT NULL,
        campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        contributor_wallet VARCHAR(42) NOT NULL,
        nft_level VARCHAR(16) NOT NULL,
        ipfs_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_supporter_nfts_wallet ON supporter_nfts(contributor_wallet)`
    );

    await client.query(`
      CREATE TABLE IF NOT EXISTS creator_profiles (
        wallet VARCHAR(42) PRIMARY KEY,
        ens_name VARCHAR(255),
        lens_handle VARCHAR(255),
        ceramic_did VARCHAR(255),
        is_verified BOOLEAN DEFAULT FALSE,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_creator_profiles_verified ON creator_profiles(is_verified);`);
  } finally {
    client.release();
  }
}
