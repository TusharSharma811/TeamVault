import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { User } from "../models/User.js";

export interface AuthedRequest extends Request {
  user?: { id: string };
}

export function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  const hdr = req.headers.authorization || "";
  const token = hdr.startsWith("Bearer ") ? hdr.substring(7) : undefined;
  if (!token) return res.status(401).json({ error: "Missing token" });
  try {
    const payload = jwt.verify(token, config.jwtSecret) as { id: string };
    req.user = { id: payload.id };
    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid token" });
  }
}
