#!/usr/bin/env node

import { spawn } from "child_process";

function parseArgs(argv) {
  const args = [...argv];
  let attempts = 2;
  let delayMs = 1500;

  const separatorIndex = args.indexOf("--");
  const optionArgs =
    separatorIndex >= 0 ? args.slice(0, separatorIndex) : args;
  const commandArgs =
    separatorIndex >= 0 ? args.slice(separatorIndex + 1) : [];

  optionArgs.forEach(arg => {
    if (arg.startsWith("--attempts=")) {
      attempts = Number(arg.split("=")[1] || "");
    } else if (arg.startsWith("--delay-ms=")) {
      delayMs = Number(arg.split("=")[1] || "");
    }
  });

  if (!Number.isFinite(attempts) || attempts <= 0) {
    throw new Error(`Invalid --attempts value: ${attempts}`);
  }

  if (!Number.isFinite(delayMs) || delayMs < 0) {
    throw new Error(`Invalid --delay-ms value: ${delayMs}`);
  }

  if (commandArgs.length === 0) {
    throw new Error(
      "No command provided. Example: node scripts/run-with-retry.mjs --attempts=2 -- npm test",
    );
  }

  return {
    attempts,
    delayMs,
    command: commandArgs[0],
    commandArgs: commandArgs.slice(1),
  };
}

function runCommand(command, commandArgs) {
  return new Promise(resolve => {
    const child = spawn(command, commandArgs, {
      stdio: "inherit",
      env: process.env,
    });

    child.on("exit", code => {
      resolve(typeof code === "number" ? code : 1);
    });
    child.on("error", () => {
      resolve(1);
    });
  });
}

async function main() {
  const { attempts, delayMs, command, commandArgs } = parseArgs(
    process.argv.slice(2),
  );

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    console.log(
      `run-with-retry: attempt ${attempt}/${attempts} -> ${command} ${commandArgs.join(" ")}`.trim(),
    );
    const exitCode = await runCommand(command, commandArgs);
    if (exitCode === 0) {
      process.exit(0);
    }

    if (attempt < attempts) {
      console.warn(
        `run-with-retry: attempt ${attempt} failed (exit=${exitCode}), retrying in ${delayMs}ms...`,
      );
      await new Promise(resolve => {
        setTimeout(resolve, delayMs);
      });
      continue;
    }

    console.error(
      `run-with-retry: all ${attempts} attempts failed (last exit=${exitCode}).`,
    );
    process.exit(exitCode);
  }
}

main().catch(error => {
  console.error(
    "run-with-retry failed:",
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});
