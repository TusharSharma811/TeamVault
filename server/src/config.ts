import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "4000", 10),
  mongoUri: process.env.MONGO_URI!,
  jwtSecret: process.env.JWT_SECRET!,
  cryptoSecret: process.env.CRYPTO_SECRET!,
  corsOrigin: process.env.CORS_ORIGIN || "*",
};
