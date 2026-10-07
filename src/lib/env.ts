import { z } from "zod";

const schema = z.object({
  supabaseUrl: z.url(),
  supabaseAnonKey: z.string().min(1),
  siteUrl: z.url().default("http://localhost:3000"),
  appEnv: z.enum(["development", "staging", "production"]).default("development"),
});

// Las NEXT_PUBLIC_* deben referenciarse literalmente para que Next las embeba en el bundle.
export const env = schema.parse({
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || undefined,
  appEnv: process.env.NEXT_PUBLIC_APP_ENV || undefined,
});
