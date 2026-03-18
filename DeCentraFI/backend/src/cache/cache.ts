import { getRedis } from "../config/redis.js";

export async function cacheGetJson<T>(key: string): Promise<T | null> {
  const redis = await getRedis();
  if (!redis) return null;
  const raw = await redis.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSetJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;
  const ttl = Math.max(1, Math.floor(ttlSeconds || 1));
  await redis.set(key, JSON.stringify(value), { EX: ttl });
}

export async function cacheGetOrSet<T>(
  key: string,
  ttlSeconds: number,
  fn: () => Promise<T>
): Promise<T> {
  const cached = await cacheGetJson<T>(key);
  if (cached !== null) return cached;
  const fresh = await fn();
  await cacheSetJson(key, fresh, ttlSeconds);
  return fresh;
}

