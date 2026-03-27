/**
 * Seed Postgres with demo campaigns, contributions, profiles, and supporter NFTs.
 * Invoked automatically after `npm run build` when DATABASE_URL is reachable.
 * Run manually: npm run seed
 * Re-run with existing data: FORCE_SEED=true npm run seed  (truncates campaign-related tables)
 */
import { connectDb, pool } from "../src/config/db.js";
import { registerCampaignChainAddress } from "../src/services/campaignService.js";

const SEPOLIA = 11155111;
const MAINNET = 1;

const demoWallet = "0xc68e79b508fe350941d97f2d9451b5b56ffcabba";

function txHash(i: number): string {
  return `0x${i.toString(16).padStart(64, "0")}`;
}

function isDatabaseUnreachable(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; errors?: unknown[] };
  if (e.code === "ECONNREFUSED" || e.code === "ENOTFOUND") return true;
  if (Array.isArray(e.errors)) {
    return e.errors.some(
      (x) => typeof x === "object" && x !== null && (x as { code?: string }).code === "ECONNREFUSED"
    );
  }
  return false;
}

async function truncateIfForced(): Promise<void> {
  if (process.env.FORCE_SEED !== "true") return;
  await pool.query("TRUNCATE supporter_nfts, campaign_reports, contributions, campaign_chain_addresses, campaigns RESTART IDENTITY CASCADE");
  console.log("[seed] FORCE_SEED=true: truncated campaign-related tables.");
}

async function main(): Promise<void> {
  await connectDb();
  await truncateIfForced();

  const count = await pool.query("SELECT COUNT(*)::int AS c FROM campaigns");
  const n = count.rows[0]?.c ?? 0;
  if (n > 0 && process.env.FORCE_SEED !== "true") {
    console.log(`[seed] Skipping: ${n} campaign(s) already exist. Set FORCE_SEED=true to replace.`);
    await pool.end();
    return;
  }

  const now = Date.now();
  const in30d = new Date(now + 30 * 86400000);
  const in7d = new Date(now + 7 * 86400000);
  const past = new Date(now - 3 * 86400000);

  const rows: {
    title: string;
    description: string;
    goal: string;
    deadline: Date;
    creator: string;
    campaign_address: string;
    tx_hash: string;
    total_raised: string;
    status: string;
    category: string;
    is_verified: boolean;
    chain_id: number;
  }[] = [
    {
      title: "Open-source analytics dashboard",
      description:
        "Fund development of a privacy-preserving analytics layer for small teams. Milestones include design, MVP, and audit.",
      goal: "5000000000000000000",
      deadline: in30d,
      creator: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      campaign_address: "0x1000000000000000000000000000000000000001",
      tx_hash: txHash(1001),
      total_raised: "1200000000000000000",
      status: "Active",
      category: "Technology",
      is_verified: true,
      chain_id: SEPOLIA,
    },
    {
      title: "Community solar micro-grid",
      description:
        "Raise capital for a neighborhood solar pilot. Contributors receive governance tokens tied to project milestones.",
      goal: "1000000000000000000",
      deadline: in7d,
      creator: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      campaign_address: "0x1000000000000000000000000000000000000002",
      tx_hash: txHash(1002),
      total_raised: "800000000000000000",
      status: "Active",
      category: "Environment",
      is_verified: false,
      chain_id: SEPOLIA,
    },
    {
      title: "Indie film: Last Mile",
      description: "Production funding for a documentary on decentralized infrastructure. Refunds if goal not met.",
      goal: "300000000000000000000",
      deadline: past,
      creator: "0xcccccccccccccccccccccccccccccccccccccccc",
      campaign_address: "0x1000000000000000000000000000000000000003",
      tx_hash: txHash(1003),
      total_raised: "300000000000000000000",
      status: "Successful",
      category: "Film",
      is_verified: true,
      chain_id: SEPOLIA,
    },
    {
      title: "Public goods QF round",
      description: "Quadratic funding round for local open-source projects. Matched pool from partners.",
      goal: "250000000000000000000",
      deadline: in30d,
      creator: "0xdddddddddddddddddddddddddddddddddddddddd",
      campaign_address: "0x1000000000000000000000000000000000000004",
      tx_hash: txHash(1004),
      total_raised: "90000000000000000000",
      status: "Active",
      category: "Community",
      is_verified: true,
      chain_id: SEPOLIA,
    },
    {
      title: "Hackathon bounties",
      description: "Sponsor prizes for ETHGlobal-style builders. Funds released per milestone.",
      goal: "15000000000000000000",
      deadline: in30d,
      creator: demoWallet,
      campaign_address: "0x1000000000000000000000000000000000000005",
      tx_hash: txHash(1005),
      total_raised: "2000000000000000000",
      status: "Active",
      category: "Education",
      is_verified: false,
      chain_id: SEPOLIA,
    },
    {
      title: "Archive historical maps (NFT rewards)",
      description: "Digitize and index rare maps; supporters get commemorative NFTs at tiers.",
      goal: "800000000000000000",
      deadline: in7d,
      creator: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      campaign_address: "0x1000000000000000000000000000000000000006",
      tx_hash: txHash(1006),
      total_raised: "100000000000000000",
      status: "Active",
      category: "Art",
      is_verified: true,
      chain_id: MAINNET,
    },
  ];

  for (const r of rows) {
    const ins = await pool.query(
      `INSERT INTO campaigns (
        title, description, goal, deadline, creator, campaign_address, tx_hash,
        total_raised, status, category, is_verified
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING id`,
      [
        r.title,
        r.description,
        r.goal,
        r.deadline,
        r.creator.toLowerCase(),
        r.campaign_address.toLowerCase(),
        r.tx_hash,
        r.total_raised,
        r.status,
        r.category,
        r.is_verified,
      ]
    );
    const id = ins.rows[0].id as number;
    await registerCampaignChainAddress(id, r.chain_id, r.campaign_address);
    if (r.chain_id === SEPOLIA) {
      await registerCampaignChainAddress(id, MAINNET, r.campaign_address);
    }
  }

  const campaignIds = (await pool.query("SELECT id FROM campaigns ORDER BY id")).rows as { id: number }[];

  let contribIdx = 2000;
  for (const { id } of campaignIds) {
    await pool.query(
      `INSERT INTO contributions (campaign_id, contributor_address, amount_wei, tx_hash, chain_id)
       VALUES ($1,$2,$3,$4,$5)`,
      [id, demoWallet, "500000000000000000", txHash(contribIdx++), SEPOLIA]
    );
    await pool.query(
      `INSERT INTO contributions (campaign_id, contributor_address, amount_wei, tx_hash, chain_id)
       VALUES ($1,$2,$3,$4,$5)`,
      [id, "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "250000000000000000", txHash(contribIdx++), SEPOLIA]
    );
  }

  await pool.query(
    `INSERT INTO creator_profiles (wallet, ens_name, is_verified) VALUES
     ($1, 'demo.eth', true),
     ($2, NULL, false),
     ($3, 'film.eth', true)
     ON CONFLICT (wallet) DO UPDATE SET ens_name = EXCLUDED.ens_name, is_verified = EXCLUDED.is_verified`,
    [
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      demoWallet,
      "0xcccccccccccccccccccccccccccccccccccccccc",
    ]
  );

  const c1 = campaignIds[0]?.id;
  const c5 = campaignIds[4]?.id;
  if (c1) {
    await pool.query(
      `INSERT INTO supporter_nfts (token_id, campaign_id, contributor_wallet, nft_level, ipfs_hash)
       VALUES ($1,$2,$3,$4,$5)`,
      [1001, c1, demoWallet, "Gold", "ipfs://QmSeedDemoGold"]
    );
  }
  if (c5) {
    await pool.query(
      `INSERT INTO supporter_nfts (token_id, campaign_id, contributor_wallet, nft_level, ipfs_hash)
       VALUES ($1,$2,$3,$4,$5)`,
      [5005, c5, demoWallet, "Silver", "ipfs://QmSeedDemoSilver"]
    );
  }

  const reportCampaignId = campaignIds[1]?.id;
  if (reportCampaignId) {
    await pool.query(
      `INSERT INTO campaign_reports (campaign_id, reporter_wallet, reason) VALUES ($1, $2, $3)
       ON CONFLICT (campaign_id, reporter_wallet) DO NOTHING`,
      [reportCampaignId, demoWallet, "Demo report — verify flow only"]
    );
  }

  console.log(`[seed] Inserted ${rows.length} campaigns, contributions, profiles, and sample NFTs.`);
  await pool.end();
}

main().catch((e) => {
  if (isDatabaseUnreachable(e)) {
    console.warn(
      "[seed] Skipped: database not reachable (set DATABASE_URL for build-time seed, or run `npm run seed` manually)."
    );
    process.exit(0);
  }
  console.error(e);
  process.exit(1);
});
