import { redis } from "../redis.js";

const FEED_VERSION_KEY = "posts:feed:version";

export const invalidate = {
  // Bump the version instead of scanning keys. All parameterized feed keys
  // from the previous version become unreachable and expire naturally.
  onNewPost: async () => {
    await redis.incr(FEED_VERSION_KEY);
  },
  onProfileEdit: async (userId) => {
    await redis.del("user:" + userId);
  },
};

export { FEED_VERSION_KEY };
