import { z } from 'zod';

const client = z.enum(['web', 'native']);
export const loginSchema = z.strictObject({
  email: z.email().max(254),
  password: z.string().min(1).max(128),
  client,
});
export const signupSchema = loginSchema.extend({ password: z.string().min(15).max(128) });
export const resendSchema = z.strictObject({ email: z.email().max(254), client });
export const confirmSchema = signupSchema.extend({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});
export const sessionSchema = z.strictObject({
  client: client.optional(),
  refreshToken: z.string().max(128).optional(),
});
export const emptySchema = z.strictObject({});
export const pairSchema = z.strictObject({
  name: z.string().trim().min(1).max(80),
  timezone: z.string().refine((value) => {
    try {
      new Intl.DateTimeFormat('en', { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, 'Use an IANA timezone'),
});
export const inviteSchema = z.strictObject({ email: z.email().max(254) });
export const acceptSchema = z.strictObject({ token: z.string().min(32).max(256) });
export const goalSchema = z.strictObject({
  title: z.string().trim().min(1).max(160),
  description: z.string().max(2000).optional(),
  weekdays: z
    .array(z.number().int().min(1).max(7))
    .min(1)
    .max(7)
    .refine((days) => new Set(days).size === days.length, 'Weekdays must be unique'),
  requiredCount: z.number().int().min(1).max(7),
  weeklyTokens: z.number().int().min(1).max(1_000_000),
});
export const rewardSchema = z.strictObject({
  title: z.string().trim().min(1).max(160),
  description: z.string().max(2000).optional(),
  fulfillmentExpectation: z.string().trim().min(1).max(1000),
  cost: z.number().int().min(1).max(1_000_000),
});
export type CreateGoal = z.infer<typeof goalSchema>;
export type CreateReward = z.infer<typeof rewardSchema>;
