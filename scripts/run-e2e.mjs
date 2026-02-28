import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const npmExecPath = process.env.npm_execpath;
const useNpmCliScript = Boolean(npmExecPath);
const npmCommand = useNpmCliScript ? process.execPath : "npm";
const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:3100";
const appUrl = new URL(baseUrl);
const appPort = appUrl.port || (appUrl.protocol === "https:" ? "443" : "80");

const loadEnvFileIfExists = (fileName) => {
  if (!existsSync(fileName)) {
    return;
  }
  if (typeof process.loadEnvFile !== "function") {
    return;
  }
  try {
    process.loadEnvFile(fileName);
  } catch {
    // Ignore malformed optional local env files in CI.
  }
};

const spawnNpm = (args, options = {}) => {
  const commandArgs = useNpmCliScript ? [npmExecPath, ...args] : args;
  return spawn(npmCommand, commandArgs, {
    stdio: "inherit",
    shell: false,
    ...options,
  });
};

const runCommand = (args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawnNpm(args, options);

    child.on("error", (error) => reject(error));
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`npm ${args.join(" ")} failed with exit code ${code}`));
    });
  });

const killProcessTree = (pid) =>
  new Promise((resolve) => {
    if (!pid) {
      resolve();
      return;
    }

    if (process.platform === "win32") {
      const killer = spawn("taskkill", ["/pid", String(pid), "/t", "/f"], {
        stdio: "ignore",
        shell: false,
      });
      killer.on("error", () => resolve());
      killer.on("exit", () => resolve());
      return;
    }

    try {
      process.kill(pid, "SIGTERM");
    } catch {
      resolve();
      return;
    }
    resolve();
  });

const waitForApp = async () => {
  const timeoutMs = 120_000;
  const started = Date.now();
  const target = `${baseUrl}/login`;

  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(target);
      if (response.ok) {
        return;
      }
    } catch {
      // App is not ready yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 1_500));
  }

  throw new Error(`App did not become ready in time: ${target}`);
};

const main = async () => {
  loadEnvFileIfExists(".env");
  loadEnvFileIfExists(".env.local");

  await runCommand(["run", "build"]);
  await runCommand(["exec", "--", "playwright", "install", "chromium"]);

  const appProcess = spawnNpm(
    ["run", "start", "--", "-p", String(appPort), "--hostname", appUrl.hostname || "127.0.0.1"],
    {
      env: {
        ...process.env,
      },
    },
  );

  let appExitedEarly = false;
  appProcess.on("exit", (code) => {
    if (code !== null && code !== 0) {
      appExitedEarly = true;
    }
  });

  try {
    await waitForApp();
    if (appExitedEarly) {
      throw new Error("Next.js app exited before tests started.");
    }

    await runCommand(["run", "test:seed"], {
      env: {
        ...process.env,
        TEST_BASE_URL: baseUrl,
      },
    });

    await runCommand(["run", "test:e2e:playwright"], {
      env: {
        ...process.env,
        TEST_BASE_URL: baseUrl,
      },
    });

    await runCommand(["run", "test:rls"], {
      env: {
        ...process.env,
        TEST_BASE_URL: baseUrl,
      },
    });
  } finally {
    await killProcessTree(appProcess.pid);
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
