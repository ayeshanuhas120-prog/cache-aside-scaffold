import { redis } from "../redis.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Cache-aside helper with a short-lived NX lock to reduce cache stampedes.
 */
export async function cached(key, ttl, fetcher) {
  const hit = await redis.get(key);
  if (hit !== null) return JSON.parse(hit);

  const lockKey = "lock:" + key;
  const got = await redis.set(lockKey, "1", "NX", "EX", 5);

  if (got) {
    try {
      // Another request may have filled the cache just before we acquired the lock.
      const secondHit = await redis.get(key);
      if (secondHit !== null) return JSON.parse(secondHit);

      const value = await fetcher();
      await redis.set(key, JSON.stringify(value), "EX", ttl);
      return value;
    } finally {
      // Only the lock owner reaches this block. The lock also expires after 5s
      // if the process dies unexpectedly.
      await redis.del(lockKey);
    }
  }

  // Another request is populating this key. Wait briefly and check again.
  for (let attempt = 0; attempt < 10; attempt++) {
    await sleep(50);
    const waitingHit = await redis.get(key);
    if (waitingHit !== null) return JSON.parse(waitingHit);
  }

  // If the lock holder failed or the query took unusually long, avoid hanging
  // forever; fetch as a fallback.
  return fetcher();
}
