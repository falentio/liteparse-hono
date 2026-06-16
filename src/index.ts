import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { configureLogger, getServerLogger } from "./logger";
import { getMaxSizeBytes } from "./config";

const port = Number(process.env.PORT ?? 5707);

await configureLogger();
getMaxSizeBytes();

serve({ fetch: createApp().fetch, port }, (info) => {
  getServerLogger().info("liteparse-hono listening on port {port}", {
    port: info.port,
  });
});
