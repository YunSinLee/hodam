import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

import { afterEach, describe, expect, it } from "vitest";

import {
  assertSafePublicEnv,
  findPrivateSupabaseCredential,
} from "./public-env-safety.cjs";
import { checkPublicArtifacts } from "../check-public-artifacts.mjs";

const require = createRequire(import.meta.url);
const repo = path.resolve(import.meta.dirname, "../..");
const tempDirs: string[] = [];
const jwt = (role: string) =>
  [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ),
    Buffer.from(
      JSON.stringify({ role, ref: "synthetic-test-project" }),
    ).toString("base64url"),
    "synthetic_signature",
  ].join(".");
const privateKey = jwt("service_role");
const anonKey = jwt("anon");
const secretKey = "sb_secret_synthetic_test_key";
const publishableKey = "sb_publishable_synthetic_test_key";

function tempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hodam-public-env-"));
  tempDirs.push(dir);
  return dir;
}

function writeFile(dir: string, name: string, text: string) {
  const file = path.join(dir, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

function assertRedacted(text: string, key: string) {
  expect(text).not.toContain(key);
  expect(text).not.toContain(key.slice(-12));
  if (key.includes(".")) expect(text).not.toContain(key.split(".")[1]);
}

afterEach(() => {
  for (const dir of tempDirs.splice(0))
    fs.rmSync(dir, { recursive: true, force: true });
});

describe("public environment safety", () => {
  it.each([anonKey, publishableKey])(
    "accepts public Supabase credentials",
    key => {
      expect(() =>
        assertSafePublicEnv({ NEXT_PUBLIC_SUPABASE_ANON_KEY: key }),
      ).not.toThrow();
    },
  );

  it("allows missing public configuration for isolated CI builds", () => {
    expect(() => assertSafePublicEnv({})).not.toThrow();
  });

  it("permits server credentials in server-only variables", () => {
    expect(() =>
      assertSafePublicEnv({
        NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
        SUPABASE_SERVICE_ROLE_KEY: privateKey,
        SUPABASE_SECRET_KEY: secretKey,
      }),
    ).not.toThrow();
  });

  it.each([privateKey, secretKey, jwt("authenticated"), "invalid-public-key"])(
    "rejects non-public credentials in the public Supabase key slot without disclosure",
    key => {
      let error: unknown;
      try {
        assertSafePublicEnv({ NEXT_PUBLIC_SUPABASE_ANON_KEY: key });
      } catch (caught) {
        error = caught;
      }
      expect(error).toBeInstanceOf(Error);
      expect(String(error)).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
      assertRedacted(String(error), key);
    },
  );

  it.each([privateKey, secretKey])(
    "rejects private keys in any public variable",
    key => {
      expect(() =>
        assertSafePublicEnv({ NEXT_PUBLIC_OTHER: `prefix:${key}` }),
      ).toThrow("NEXT_PUBLIC_OTHER");
    },
  );

  it("does not mistake role labels or key-prefix documentation for credentials", () => {
    expect(
      findPrivateSupabaseCredential(
        'role = "service_role"; prefix = "sb_secret_";',
      ),
    ).toBeNull();
    expect(findPrivateSupabaseCredential(anonKey)).toBeNull();
  });
});

describe("build and environment check integration", () => {
  it.each(["phase-production-build", "phase-development-server"])(
    "rejects private credentials loaded from local env before Next compilation (%s)",
    phase => {
      const dir = tempDir();
      writeFile(
        dir,
        "next.config.js",
        fs.readFileSync(path.join(repo, "next.config.js"), "utf8"),
      );
      writeFile(
        dir,
        "scripts/lib/public-env-safety.cjs",
        fs.readFileSync(
          path.join(repo, "scripts/lib/public-env-safety.cjs"),
          "utf8",
        ),
      );
      writeFile(dir, ".env", `NEXT_PUBLIC_SUPABASE_ANON_KEY=${privateKey}\n`);
      const code = `require(${JSON.stringify(require.resolve("next/dist/server/config"))}).default(${JSON.stringify(phase)}, process.cwd()).catch(error => { console.error(error.message); process.exitCode = 1; });`;
      const result = spawnSync(process.execPath, ["-e", code], {
        cwd: dir,
        env: {
          PATH: process.env.PATH,
          NODE_ENV:
            phase === "phase-production-build" ? "production" : "development",
        },
        encoding: "utf8",
      });
      expect(result.status).toBe(1);
      expect(result.stdout + result.stderr).toContain(
        "Unsafe public environment variable",
      );
      assertRedacted(result.stdout + result.stderr, privateKey);
      expect(fs.existsSync(path.join(dir, ".next/static"))).toBe(false);
    },
  );

  it.each([{ args: [] }, { args: ["--strict"] }])(
    "environment checker fails in normal and strict modes",
    ({ args }) => {
      const dir = tempDir();
      writeFile(dir, ".env", `NEXT_PUBLIC_SUPABASE_ANON_KEY=${privateKey}\n`);
      const result = spawnSync(
        process.execPath,
        [path.join(repo, "scripts/check-env.mjs"), ...args],
        {
          cwd: dir,
          env: { PATH: process.env.PATH, NODE_ENV: "development" },
          encoding: "utf8",
        },
      );
      expect(result.status).toBe(1);
      expect(result.stdout + result.stderr).toContain(
        "Unsafe public environment variable",
      );
      assertRedacted(result.stdout + result.stderr, privateKey);
    },
  );

  it("environment checker validates process overrides and prints no credential fragments", () => {
    const dir = tempDir();
    writeFile(dir, ".env", `NEXT_PUBLIC_SUPABASE_ANON_KEY=${privateKey}\n`);
    const result = spawnSync(
      process.execPath,
      [path.join(repo, "scripts/check-env.mjs")],
      {
        cwd: dir,
        env: {
          PATH: process.env.PATH,
          NODE_ENV: "development",
          NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
          NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
          SUPABASE_SERVICE_ROLE_KEY: privateKey,
        },
        encoding: "utf8",
      },
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY = (set)");
    assertRedacted(result.stdout + result.stderr, anonKey);
    assertRedacted(result.stdout + result.stderr, privateKey);
  });
});

describe("public build output", () => {
  it.each([
    ".next/static/chunks/app.js",
    ".next/static/chunks/app.js.map",
    "public/config.js",
    ".next/server/app/page.html",
    ".next/server/app/page.rsc",
    ".next/server/app/config.body",
    ".next/server/pages/story.json",
  ])("rejects a server credential in %s without printing it", file => {
    const dir = tempDir();
    fs.mkdirSync(path.join(dir, ".next/static"), { recursive: true });
    writeFile(dir, file, `window.key = ${JSON.stringify(privateKey)};`);
    let error: unknown;
    try {
      checkPublicArtifacts(dir);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(Error);
    expect(String(error)).toContain(file);
    assertRedacted(String(error), privateKey);
  });

  it("rejects new Supabase secret keys too", () => {
    const dir = tempDir();
    writeFile(dir, ".next/static/config.js", secretKey);
    expect(() => checkPublicArtifacts(dir)).toThrow("Supabase secret key");
  });

  it("allows anon/publishable credentials and excludes private server code", () => {
    const dir = tempDir();
    writeFile(dir, ".next/static/config.js", `${anonKey}\n${publishableKey}`);
    writeFile(dir, ".next/server/app/page.js", privateKey);
    expect(checkPublicArtifacts(dir)).toBe(1);
  });

  it("fails when no completed build is available", () => {
    expect(() => checkPublicArtifacts(tempDir())).toThrow(
      "completed Next build",
    );
  });

  it("the postbuild hook retains sitemap generation and runs the scanner", () => {
    const { scripts } = JSON.parse(
      fs.readFileSync(path.join(repo, "package.json"), "utf8"),
    );
    expect(scripts.postbuild).toContain(
      "next-sitemap && node scripts/normalize-sitemap.mjs",
    );
    expect(scripts.postbuild).toContain(
      "node scripts/check-public-artifacts.mjs",
    );
  });
});
