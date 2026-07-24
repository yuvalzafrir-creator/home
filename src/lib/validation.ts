import { z } from "zod";

export const onboardingSchema = z.object({
  locations: z.array(z.string()).min(1),
  budgetMax: z.number().int().positive(),
  minRooms: z.number().positive().optional(),
  minSizeSqm: z.number().int().positive().optional(),
  mustHaveExtras: z.array(z.string()).default([]),
  settlementTypes: z.array(z.string()).default([]),
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

export const listingNotesSchema = z.object({
  notes: z.string().max(5000),
});

export type ListingNotesInput = z.infer<typeof listingNotesSchema>;

export const extractUrlSchema = z.object({
  url: z.string().url().refine((u) => /^https?:\/\//i.test(u), "URL must be http(s)"),
});

export const addListingSchema = z.object({
  url: z.string().url().refine((u) => /^https?:\/\//i.test(u), "URL must be http(s)"),
  address: z.string().min(1),
  price: z.number().int().positive(),
  rooms: z.number().positive(),
  sizeSqm: z.number().int().positive(),
  floor: z.number().int().nullable().optional(),
  hasParking: z.boolean().default(false),
  hasBalcony: z.boolean().default(false),
  hasMamad: z.boolean().default(false),
  hasElevator: z.boolean().default(false),
  description: z.string().nullable().optional(),
});

export type AddListingInput = z.infer<typeof addListingSchema>;

export const profilePatchSchema = z.object({
  locations: z.array(z.string()).min(1).optional(),
  budgetMax: z.number().int().positive().optional(),
  minRooms: z.number().positive().nullable().optional(),
  minSizeSqm: z.number().int().positive().nullable().optional(),
  mustHaveExtras: z.array(z.string()).optional(),
  settlementTypes: z.array(z.string()).optional(),
  goal: z.enum(["primary", "investment"]).optional(),
  openToRenting: z.boolean().optional(),
  openToFixerUpper: z.boolean().optional(),
  renovationBudget: z.number().int().nonnegative().nullable().optional(),
  freeText: z.string().nullable().optional(),
});

export type ProfilePatch = z.infer<typeof profilePatchSchema>;

// Client-action tool inputs from the assistant. `path` must be an internal
// route (starts with a single "/") so the model can never redirect the browser
// to an external URL via router.push.
export const authSchema = z.object({
  name: z.string().trim().min(1).max(40),
  password: z.string().min(6).max(100),
});

export const navigateActionSchema = z.object({
  path: z.string().regex(/^\/(?!\/)/, "path must be an internal route"),
});
export const filterActionSchema = z.object({
  filter: z.enum(["all", "favorites", "unseen"]),
});
