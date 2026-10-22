import { Router } from "express";
import { prisma, slowQuery } from "../db.js";
import { cached } from "../cache/cached.js";
import { invalidate, FEED_VERSION_KEY } from "../cache/invalidation.js";
import { redis } from "../redis.js";

const router = Router();

// READ (hot): parameter-aware cache key includes feed version, page and sort.
router.get("/posts/feed", async (req, res) => {
  const page = Math.max(1, Number(req.query.page ?? 1));
  const sort = req.query.sort === "hot" ? "hot" : "new";
  const version = (await redis.get(FEED_VERSION_KEY)) ?? "0";
  const key = `posts:feed:v${version}:page:${page}:sort:${sort}`;

  const feed = await cached(key, 15, async () => {
    await slowQuery();
    return prisma.post.findMany({
      orderBy: sort === "hot" ? { likes: "desc" } : { createdAt: "desc" },
      skip: (page - 1) * 20,
      take: 20,
      include: { author: true },
    });
  });

  res.json(feed);
});

// WRITE: creating a post bumps the feed version so all pages/sorts are invalidated.
router.post("/posts", async (req, res) => {
  const post = await prisma.post.create({ data: req.body });
  await invalidate.onNewPost();
  res.status(201).json(post);
});

export default router;
