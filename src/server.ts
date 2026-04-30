import Fastify from "fastify";
import { dbPlugin } from "./plugins/db.js";
import { brokerApiRoutes } from "./routes/api.js";
import { brokerUiRoutes } from "./routes/ui.js";

export async function buildServer() {
  const server = Fastify({
    logger: true,
    bodyLimit: 10 * 1024 * 1024,
  });

  await server.register(dbPlugin);
  server.get("/health", async () => ({ ok: true, service: "deal_flow_service" }));
  await server.register(brokerUiRoutes);
  await server.register(brokerApiRoutes, { prefix: "/broker" });

  return server;
}
