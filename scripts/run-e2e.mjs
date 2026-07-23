import { spawn } from "node:child_process";
import { resolve } from "node:path";

const host = "localhost";
const port = "3100";
const providedBaseURL = process.env.PLAYWRIGHT_BASE_URL;
const baseURL = providedBaseURL || `http://${host}:${port}`;
const nextCli = resolve("node_modules/next/dist/bin/next");
const playwrightCli = resolve("node_modules/@playwright/test/cli.js");
const serverOutput = [];

const server = providedBaseURL
  ? null
  : spawn(process.execPath, [nextCli, "dev", "--hostname", host, "--port", port], {
      cwd: process.cwd(),
      detached: process.platform !== "win32",
      env: {
        ...process.env,
        DEMO_MODE_ENABLED: "true",
        NEXT_PUBLIC_APP_URL: baseURL,
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

if (server) {
  console.log(`Starting isolated E2E server at ${baseURL}...`);
  for (const stream of [server.stdout, server.stderr]) {
    stream.on("data", (chunk) => {
      serverOutput.push(String(chunk));
      if (serverOutput.length > 30) serverOutput.shift();
    });
  }
}

async function waitForServer() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (!server) return;
    if (server.exitCode !== null) {
      throw new Error(`The E2E server exited before it was ready.\n${serverOutput.join("")}`);
    }
    try {
      const response = await fetch(baseURL, { signal: AbortSignal.timeout(2_000) });
      if (response.status >= 200) return;
    } catch {
      // The bounded readiness loop will retry.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  throw new Error(`The E2E server did not become ready.\n${serverOutput.join("")}`);
}

function runPlaywright() {
  const child = spawn(process.execPath, [playwrightCli, "test"], {
    cwd: process.cwd(),
    env: { ...process.env, PLAYWRIGHT_BASE_URL: baseURL },
    stdio: "inherit",
    windowsHide: true,
  });
  return new Promise((resolvePromise, rejectPromise) => {
    child.once("error", rejectPromise);
    child.once("exit", (code, signal) => {
      if (signal) rejectPromise(new Error(`Playwright stopped with signal ${signal}.`));
      else resolvePromise(code ?? 1);
    });
  });
}

async function stopServer() {
  if (!server?.pid || server.exitCode !== null) return;
  const exited = new Promise((resolvePromise) => server.once("exit", resolvePromise));
  try {
    if (process.platform === "win32") server.kill("SIGTERM");
    else process.kill(-server.pid, "SIGTERM");
  } catch {
    // The server may have exited between the state check and signal.
  }
  await Promise.race([
    exited,
    new Promise((resolvePromise) => setTimeout(resolvePromise, 2_000)),
  ]);

  if (process.platform === "win32" && server.exitCode === null) {
    const killer = spawn("taskkill", ["/pid", String(server.pid), "/T", "/F"], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    killer.unref();
  }
  server.stdout.destroy();
  server.stderr.destroy();
  server.unref();
}

let exitCode = 1;
try {
  if (server) {
    await waitForServer();
    console.log("E2E server ready; running Playwright.");
  } else {
    console.log(`Running Playwright against configured environment ${baseURL}.`);
  }
  exitCode = await runPlaywright();
} finally {
  if (server) console.log("Stopping isolated E2E server.");
  await stopServer();
}

process.exitCode = exitCode;
