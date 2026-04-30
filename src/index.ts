import { buildServer } from "./server.js";

const envLoader = (
  process as typeof process & { loadEnvFile?: (path?: string) => void }
).loadEnvFile;
envLoader?.();

const server = await buildServer();
const port = Number(process.env.PORT ?? 3010);
const host = "0.0.0.0";

try {
  await server.listen({ port, host });
  server.log.info(`Deal Flow service running on http://${host}:${port}`);
} catch (err) {
  server.log.error(err);
  process.exit(1);
}
