import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { config } from "../config.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { User, type IUser } from "../models/User.js";

const router = Router();

function toPublicUser(user: Pick<IUser, "_id" | "email" | "name">) {
  return {
    id: String(user._id),
    email: user.email,
    name: user.name,
  };
}

function signToken(userId: unknown) {
  return jwt.sign({ id: String(userId) }, config.jwtSecret, {
    expiresIn: "7d",
  });
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

router.post("/register", asyncHandler(async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    name: z.string().min(1),
    password: z.string().min(6),
  });
  const body = schema.parse(req.body);
  const email = body.email.toLowerCase();

  const exists = await User.findOne({ email });
  if (exists) return res.status(409).json({ error: "Email already registered" });

  const passwordHash = await bcrypt.hash(body.password, 12);
  const user = await User.create({ email, name: body.name, passwordHash });
  const token = signToken(user._id);

  res.json({ token, user: toPublicUser(user) });
}));

router.post("/login", asyncHandler(async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
  });
  const body = schema.parse(req.body);
  const user = await User.findOne({ email: body.email.toLowerCase() });

  if (!user) return res.status(401).json({ error: "Invalid credentials" });
  const ok = await user.comparePassword(body.password);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const token = signToken(user._id);
  res.json({ token, user: toPublicUser(user) });
}));

router.get("/me", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  const user = await User.findById(req.user!.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(toPublicUser(user));
}));

router.get("/users", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  const schema = z.object({
    q: z.string().optional(),
    query: z.string().optional(),
  });
  const { q, query } = schema.parse(req.query);
  const term = (q || query || "").trim();
  const filter = term
    ? {
        $or: [
          { name: new RegExp(escapeRegex(term), "i") },
          { email: new RegExp(escapeRegex(term), "i") },
        ],
      }
    : {};
  const users = await User.find(filter).sort({ name: 1 }).limit(25);

  res.json(users.map(toPublicUser).filter((user) => user.id !== req.user!.id));
}));

export default router;
