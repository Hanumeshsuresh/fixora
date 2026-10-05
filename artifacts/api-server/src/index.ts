import app from "./app";
import { logger } from "./lib/logger";
import { seedFixora } from "./lib/fixora-seed";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function start(): Promise<void> {
  await seedFixora();
  app.listen(port, () => logger.info({ port }, "Server listening"));
}

start().catch((err: unknown) => {
  logger.error({ err }, "Unable to initialize Fixora");
  process.exit(1);
});
