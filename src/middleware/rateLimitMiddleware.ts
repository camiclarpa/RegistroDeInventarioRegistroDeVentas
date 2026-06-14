import rateLimit from "express-rate-limit";
export const crmWriteRateLimit = rateLimit({ windowMs: 60 * 1000, max: 60, message: { error: "Rate limit exceeded" } });
export const campaignRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 3, message: { error: "Rate limit exceeded" } });
