import fp from "fastify-plugin";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "../env.js";

export const dbPlugin = fp(async (server) => {
  const url = getEnv("SUPABASE_URL");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = getEnv("SUPABASE_ANON_KEY");

  const db = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const auth = createClient(url, anonKey, {
    auth: { persistSession: false },
  });

  server.decorate("db", db);
  server.decorate("auth", auth);
});

declare module "fastify" {
  interface FastifyInstance {
    db: SupabaseClient;
    auth: SupabaseClient;
  }
}
