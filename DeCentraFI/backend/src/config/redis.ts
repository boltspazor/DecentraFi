import { createClient } from "redis";

type AnyRedisClient = ReturnType<typeof createClient>;

let client: AnyRedisClient | null = null;
let connecting: Promise<AnyRedisClient | null> | null = null;

/**
 * Railway: reference Redis service URL (e.g. ${{ Redis.REDIS_URL }}) or discrete REDISHOST / REDISPORT / REDISPASSWORD.
 */
function getRedisUrl(): string | null {
  const direct =
    process.env.REDIS_URL?.trim() ||
    process.env.REDIS_PRIVATE_URL?.trim();
  if (direct) return direct;

  const host = process.env.REDISHOST?.trim();
  if (!host) return null;

  const port = process.env.REDISPORT?.trim() || "6379";
  const password = process.env.REDISPASSWORD?.trim();
  const user = process.env.REDISUSER?.trim();

  if (password) {
    if (user && user !== "default") {
      return `redis://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}`;
    }
    return `redis://:${encodeURIComponent(password)}@${host}:${port}`;
  }
  if (user && user !== "default") {
    return `redis://${encodeURIComponent(user)}@${host}:${port}`;
  }
  return `redis://${host}:${port}`;
}

export async function getRedis(): Promise<AnyRedisClient | null> {
  if (client) return client;
  if (connecting) return connecting;

  const url = getRedisUrl();
  if (!url) return null;

  connecting = (async () => {
    const c = createClient({ url });
    c.on("error", (err) => {
      console.error("Redis error:", err);
    });
    try {
      await c.connect();
      client = c;
      return client;
    } catch {
      try {
        await c.disconnect();
      } catch {
        // ignore
      }
      client = null;
      return null;
    } finally {
      connecting = null;
    }
  })();

  return connecting;
}

export async function closeRedis(): Promise<void> {
  if (!client) return;
  try {
    await client.disconnect();
  } finally {
    client = null;
  }
}

