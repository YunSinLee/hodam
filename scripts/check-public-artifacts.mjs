#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findPrivateSupabaseCredential } from "./lib/public-env-safety.cjs";

function filesIn(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? filesIn(file) : entry.isFile() ? [file] : [];
  });
}

export function checkPublicArtifacts(cwd = process.cwd()) {
  const staticDirectory = path.join(cwd, ".next/static");
  if (!fs.existsSync(staticDirectory)) {
    throw new Error(
      "Public artifact check requires a completed Next build (.next/static).",
    );
  }
  const files = [
    ...filesIn(staticDirectory),
    ...filesIn(path.join(cwd, "public")),
    ...filesIn(path.join(cwd, ".next/server")).filter(
      file =>
        /\.(html|rsc|body)$/.test(file) ||
        /[\\/]pages[\\/].*\.json$/.test(file),
    ),
  ];
  const findings = [];
  for (const file of files) {
    const reason = findPrivateSupabaseCredential(fs.readFileSync(file, "utf8"));
    if (reason) findings.push(`${path.relative(cwd, file)}: ${reason}`);
  }
  if (findings.length) {
    throw new Error(`Unsafe public build output:\n${findings.join("\n")}`);
  }
  return files.length;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    console.log(
      `Public artifact check passed (${checkPublicArtifacts()} files).`,
    );
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Public artifact check failed.",
    );
    process.exitCode = 1;
  }
}
