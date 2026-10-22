import { Router } from "express";
import { prisma, slowQuery } from "../db.js";
import { cached } from "../cache/cached.js";
import { invalidate } from "../cache/invalidation.js";

const router = Router();

// READ: cache key includes the user id; profile data changes infrequently.
router.get("/users/:id", async (req, res) => {
  const user = await cached("user:" + req.params.id, 300, async () => {
    await slowQuery();
    return prisma.user.findUnique({
      where: { id: req.params.id },
      include: { posts: true },
    });
  });

  if (!user) return res.status(404).json({ error: "not found" });
  res.json(user);
});

// WRITE: invalidate only this user's profile cache.
router.put("/users/:id", async (req, res) => {
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: req.body,
  });
  await invalidate.onProfileEdit(req.params.id);
  res.json(user);
});

export default router;
