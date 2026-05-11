import Redis from "ioredis";
import type { PageConfig } from "../src/lib/page-config";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    return Math.min(times * 200, 5000);
  },
});

const DRAFT_PREFIX = "draft:";
const DRAFT_TTL = 60 * 60 * 24 * 30; // 30 days

export async function getDraft(userId: string): Promise<PageConfig | null> {
  const data = await redis.get(`${DRAFT_PREFIX}${userId}`);
  if (!data) return null;
  try {
    return JSON.parse(data) as PageConfig;
  } catch {
    return null;
  }
}

export async function saveDraft(
  userId: string,
  config: PageConfig
): Promise<void> {
  await redis.set(
    `${DRAFT_PREFIX}${userId}`,
    JSON.stringify(config),
    "EX",
    DRAFT_TTL
  );
}

export async function deleteDraft(userId: string): Promise<void> {
  await redis.del(`${DRAFT_PREFIX}${userId}`);
}

export async function pingRedis(): Promise<boolean> {
  try {
    const result = await redis.ping();
    return result === "PONG";
  } catch {
    return false;
  }
}
