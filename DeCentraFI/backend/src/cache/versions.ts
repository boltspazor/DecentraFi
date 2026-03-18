import { getRedis } from "../config/redis.js";

const CAMPAIGNS_VERSION_KEY = "cache:campaigns:v";

async function getLocalFallbackVersion(): Promise<number> {
  return 1;
}

export async function getCampaignsCacheVersion(): Promise<number> {
  const redis = await getRedis();
  if (!redis) return getLocalFallbackVersion();
  const raw = await redis.get(CAMPAIGNS_VERSION_KEY);
  const n = raw ? parseInt(raw, 10) : NaN;
  if (!Number.isFinite(n) || n < 1) {
    await redis.set(CAMPAIGNS_VERSION_KEY, "1");
    return 1;
  }
  return n;
}

export async function bumpCampaignsCacheVersion(): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;
  await redis.incr(CAMPAIGNS_VERSION_KEY);
}

