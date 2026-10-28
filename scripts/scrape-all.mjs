import { neon } from "@neondatabase/serverless";
import { runScrapeAll } from "../server/scrape.js";

const concurrency = Number(process.env.SCRAPE_CONCURRENCY ?? 6);
const attempts = Number(process.env.SCRAPE_ATTEMPTS ?? 3);
const timeoutMs = Number(process.env.SCRAPE_TIMEOUT_MS ?? 30_000);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function createRetryingFetch() {
  return async (input, init = {}) => {
    let lastError;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(input, {
          ...init,
          signal: controller.signal,
        });

        if (response.ok || !isRetryableStatus(response.status) || attempt === attempts) {
          return response;
        }

        await sleep(500 * 2 ** (attempt - 1));
      } catch (error) {
        lastError = error;
        if (attempt < attempts) {
          await sleep(500 * 2 ** (attempt - 1));
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    throw lastError ?? new Error("Request failed after retries");
  };
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const sql = neon(process.env.DATABASE_URL);
const summary = await runScrapeAll({
  sql,
  concurrency,
  fetchImpl: createRetryingFetch(),
});

console.log(JSON.stringify(summary, null, 2));

if (summary.failed > 0) {
  process.exitCode = 1;
}
