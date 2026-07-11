import { z } from "zod";

export const onboardingSchema = z.object({
  locations: z.array(z.string()).min(1),
  budgetMax: z.number().int().positive(),
  minRooms: z.number().positive().optional(),
  minSizeSqm: z.number().int().positive().optional(),
  mustHaveExtras: z.array(z.string()).default([]),
  goal: z.enum(["primary", "investment"]),
  openToRenting: z.boolean().default(false),
  openToFixerUpper: z.boolean().default(false),
  renovationBudget: z.number().int().nonnegative().optional(),
  freeText: z.string().optional(),
  exampleUrls: z.array(z.string().url()).default([]),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;

export const feedbackSchema = z.object({
  listingId: z.string().min(1),
  reaction: z.enum(["like", "dislike"]),
  note: z.string().optional(),
});

export type FeedbackInput = z.infer<typeof feedbackSchema>;
