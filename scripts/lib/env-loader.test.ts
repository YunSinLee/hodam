import fs from "fs";
import os from "os";
import path from "path";

import { afterEach, describe, expect, it } from "vitest";

import {
  getEnvFileOrder,
  loadLocalEnv,
  parseEnvFile,
  readEnvValue,
} from "./env-loader.mjs";

const tempDirs = [];

function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hodam-env-loader-"));
  tempDirs.push(dir);
  return dir;
}

describe("env-loader", () => {
  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (!dir) continue;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns expected env file order", () => {
    expect(getEnvFileOrder("test")).toEqual([
      ".env",
      ".env.test",
      ".env.local",
      ".env.test.local",
    ]);
  });

  it("parses key/value pairs and strips matching quotes", () => {
    const parsed = parseEnvFile(`
# comment
FOO=bar
BAR="value with spaces"
BAZ='single-quoted'
INVALID_LINE
`);

    expect(parsed).toEqual({
      FOO: "bar",
      BAR: "value with spaces",
      BAZ: "single-quoted",
    });
  });

  it("loads env files in priority order", () => {
    const tempDir = makeTempDir();
    fs.writeFileSync(path.join(tempDir, ".env"), "FOO=from-env\nSHARED=env\n");
    fs.writeFileSync(path.join(tempDir, ".env.development"), "SHARED=development\nA=1\n");
    fs.writeFileSync(path.join(tempDir, ".env.local"), "SHARED=local\nB=2\n");
    fs.writeFileSync(
      path.join(tempDir, ".env.development.local"),
      "SHARED=development-local\nC=3\n",
    );

    const loaded = loadLocalEnv({ cwd: tempDir, nodeEnv: "development" });

    expect(loaded.merged).toEqual({
      FOO: "from-env",
      SHARED: "development-local",
      A: "1",
      B: "2",
      C: "3",
    });
    expect(loaded.loaded).toEqual([
      path.join(tempDir, ".env"),
      path.join(tempDir, ".env.development"),
      path.join(tempDir, ".env.local"),
      path.join(tempDir, ".env.development.local"),
    ]);
  });

  it("prefers process env over file env when reading values", () => {
    const value = readEnvValue("TOKEN", {
      processEnv: { TOKEN: "process-token" },
      fileEnv: { TOKEN: "file-token" },
    });

    expect(value).toBe("process-token");
  });

  it("returns fallback when no env value exists", () => {
    const value = readEnvValue("MISSING", {
      processEnv: {},
      fileEnv: {},
      fallback: "fallback-value",
    });

    expect(value).toBe("fallback-value");
  });
});
