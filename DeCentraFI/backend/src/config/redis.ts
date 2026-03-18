import { createClient } from "redis";

type AnyRedisClient = ReturnType<typeof createClient>;

let client: AnyRedisClient | null = null;
let connecting: Promise<AnyRedisClient | null> | null = null;

function getRedisUrl(): string | null {
  const url = process.env.REDIS_URL?.trim();
  return url ? url : null;
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

