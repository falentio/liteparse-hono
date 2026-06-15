import {
  configure,
  getConsoleSink,
  getLogger,
  isLogLevel,
  type LogLevel,
} from "@logtape/logtape";

let configured = false;

export async function configureLogger(): Promise<void> {
  if (configured) return;

  const envLevel = process.env.LOG_LEVEL;
  const level: LogLevel =
    envLevel && isLogLevel(envLevel) ? envLevel : "info";

  await configure({
    sinks: { console: getConsoleSink() },
    loggers: [
      {
        category: ["liteparse", "server"],
        lowestLevel: level,
        sinks: ["console"],
      },
    ],
  });

  configured = true;

  if (!process.env.LITEPARSE_API_KEY) {
    getLogger(["liteparse", "server"]).warn(
      "LITEPARSE_API_KEY not set — running unauthenticated (dev mode)",
    );
  }
}

export function getServerLogger() {
  return getLogger(["liteparse", "server"]);
}
