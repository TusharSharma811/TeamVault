import { Router } from 'express';
import { User } from '../models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../config.js';


const router = Router();


router.post('/register', async (req, res) => {
const schema = z.object({ email: z.string().email(), name: z.string().min(1), password: z.string().min(6) });
const body = schema.parse(req.body);


const exists = await User.findOne({ email: body.email });
if (exists) return res.status(409).json({ error: 'Email already registered' });
const passwordHash = await bcrypt.hash(body.password, 12);
const user = await User.create({ email: body.email, name: body.name, passwordHash });
const token = jwt.sign({ id: user._id }, config.jwtSecret, { expiresIn: '7d' });
res.json({ token, user: { id: user._id, email: user.email, name: user.name } });
});


router.post('/login', async (req, res) => {
const schema = z.object({ email: z.string().email(), password: z.string().min(1) });
const body = schema.parse(req.body);
const user = await User.findOne({ email: body.email });
if (!user) return res.status(401).json({ error: 'Invalid credentials' });
const ok = await user.comparePassword(body.password);
if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
const token = jwt.sign({ id: user._id }, config.jwtSecret, { expiresIn: '7d' });
res.json({ token, user: { id: user._id, email: user.email, name: user.name } });
});


export default router;