#!/usr/bin/env node

import fs from "fs";
import path from "path";

const args = new Set(process.argv.slice(2));

function readArgValue(prefix) {
  const raw = process.argv.find(item => item.startsWith(`${prefix}=`));
  if (!raw) return "";
  return raw.slice(prefix.length + 1).trim();
}

const runtimeOriginArg = readArgValue("--runtime-origin");
const callbackPathArg = readArgValue("--callback-path");
const providersArg = readArgValue("--providers");

const nodeEnv = process.env.NODE_ENV || "development";
const cwd = process.cwd();
const envFilesInOrder = [
  ".env",
  `.env.${nodeEnv}`,
  ".env.local",
  `.env.${nodeEnv}.local`,
];

function parseEnvFile(content) {
  const result = {};
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eqIdx = line.indexOf("=");
    if (eqIdx <= 0) continue;

    const key = line.slice(0, eqIdx).trim();
    const value = line.slice(eqIdx + 1).trim();
    const normalized =
      value.startsWith('"') && value.endsWith('"')
        ? value.slice(1, -1)
        : value.startsWith("'") && value.endsWith("'")
          ? value.slice(1, -1)
          : value;

    result[key] = normalized;
  }

  return result;
}

function loadFileEnv() {
  const merged = {};
  const loaded = [];

  for (const fileName of envFilesInOrder) {
    const fullPath = path.join(cwd, fileName);
    if (!fs.existsSync(fullPath)) continue;

    const content = fs.readFileSync(fullPath, "utf8");
    Object.assign(merged, parseEnvFile(content));
    loaded.push(fileName);
  }

  return { merged, loaded };
}

const { merged: fileEnv, loaded: loadedFiles } = loadFileEnv();

function getEnvValue(name) {
  const fromProcess = process.env[name];
  if (typeof fromProcess === "string" && fromProcess.trim()) {
    return fromProcess.trim();
  }

  const fromFile = fileEnv[name];
  if (typeof fromFile === "string" && fromFile.trim()) {
    return fromFile.trim();
  }

  return "";
}

function toOrigin(rawUrl) {
  try {
    return new URL(rawUrl).origin;
  } catch {
    return null;
  }
}

function normalizeCallbackPath(inputPath) {
  if (!inputPath) return "/auth/callback";
  if (inputPath.startsWith("/")) return inputPath;
  return `/${inputPath}`;
}

function resolveRedirectUrl({
  runtimeOrigin,
  callbackPath,
  configuredSiteUrl,
  configuredAuthRedirectUrl,
}) {
  const warnings = [];
  const runtime = toOrigin(runtimeOrigin);
  if (!runtime) {
    throw new Error(`Invalid runtime origin: ${runtimeOrigin}`);
  }

  const normalizedCallbackPath = normalizeCallbackPath(callbackPath);

  const explicit = configuredAuthRedirectUrl?.trim();
  if (explicit) {
    const explicitOrigin = toOrigin(explicit);
    if (!explicitOrigin) {
      warnings.push("NEXT_PUBLIC_AUTH_REDIRECT_URL 형식이 올바르지 않습니다.");
    } else if (explicitOrigin !== runtime) {
      warnings.push(
        `NEXT_PUBLIC_AUTH_REDIRECT_URL(${explicitOrigin})이 runtime origin(${runtime})과 다릅니다.`,
      );
    } else {
      return {
        redirectTo: new URL(normalizedCallbackPath, explicit).toString(),
        warnings,
      };
    }
  }

  const siteUrl = configuredSiteUrl?.trim();
  if (siteUrl) {
    const siteOrigin = toOrigin(siteUrl);
    if (!siteOrigin) {
      warnings.push("NEXT_PUBLIC_SITE_URL 형식이 올바르지 않습니다.");
    } else if (siteOrigin !== runtime) {
      warnings.push(
        `NEXT_PUBLIC_SITE_URL(${siteOrigin})이 runtime origin(${runtime})과 다릅니다.`,
      );
    } else {
      return {
        redirectTo: new URL(normalizedCallbackPath, siteUrl).toString(),
        warnings,
      };
    }
  }

  return {
    redirectTo: new URL(normalizedCallbackPath, runtime).toString(),
    warnings,
  };
}

function parseJsonSafe(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function maskValue(value) {
  if (!value) return "(empty)";
  if (value.length <= 8) return "*".repeat(value.length);
  return `${value.slice(0, 4)}...${value.slice(-2)}`;
}

async function fetchAuthSettings(supabaseUrl, anonKey) {
  const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
    method: "GET",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
  });

  const text = await response.text();
  const json = parseJsonSafe(text);

  return {
    status: response.status,
    ok: response.ok,
    body: json || text,
  };
}

async function checkAuthorize({ supabaseUrl, anonKey, provider, redirectTo }) {
  const url =
    `${supabaseUrl}/auth/v1/authorize?` +
    new URLSearchParams({
      provider,
      redirect_to: redirectTo,
    }).toString();

  const response = await fetch(url, {
    method: "GET",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    redirect: "manual",
  });

  const location = response.headers.get("location");
  const rawBody = await response.text();
  const body = parseJsonSafe(rawBody) || rawBody;

  return {
    status: response.status,
    ok: response.ok,
    location,
    body,
  };
}

async function main() {
  const supabaseUrl = getEnvValue("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = getEnvValue("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const siteUrl = getEnvValue("NEXT_PUBLIC_SITE_URL");
  const authRedirectUrl = getEnvValue("NEXT_PUBLIC_AUTH_REDIRECT_URL");

  const runtimeOrigin =
    runtimeOriginArg ||
    getEnvValue("HODAM_RUNTIME_ORIGIN") ||
    siteUrl ||
    "http://localhost:3000";
  const callbackPath = normalizeCallbackPath(callbackPathArg);
  const parsedProviders = providersArg
    ? providersArg
        .split(",")
        .map(item => item.trim().toLowerCase())
        .filter(Boolean)
    : [];
  const providers =
    parsedProviders.length > 0 ? parsedProviders : ["google", "kakao"];

  console.log("HODAM OAuth check");
  console.log(`- node env: ${nodeEnv}`);
  console.log(
    `- loaded env files: ${loadedFiles.length > 0 ? loadedFiles.join(", ") : "(none)"}`,
  );
  console.log(`- runtime origin: ${runtimeOrigin}`);
  console.log(`- callback path: ${callbackPath}`);
  console.log(`- providers: ${providers.join(", ")}`);
  console.log("");

  if (!supabaseUrl || !anonKey) {
    console.error(
      "Failed: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are required.",
    );
    process.exit(1);
  }

  console.log(`✓ NEXT_PUBLIC_SUPABASE_URL = ${supabaseUrl}`);
  console.log(`✓ NEXT_PUBLIC_SUPABASE_ANON_KEY = ${maskValue(anonKey)}`);
  console.log(
    `- NEXT_PUBLIC_SITE_URL = ${siteUrl || "(not set)"} | NEXT_PUBLIC_AUTH_REDIRECT_URL = ${authRedirectUrl || "(not set)"}`,
  );

  const { redirectTo, warnings } = resolveRedirectUrl({
    runtimeOrigin,
    callbackPath,
    configuredSiteUrl: siteUrl,
    configuredAuthRedirectUrl: authRedirectUrl,
  });

  console.log(`- resolved redirectTo: ${redirectTo}`);
  if (warnings.length > 0) {
    warnings.forEach(message => {
      console.warn(`! warning: ${message}`);
    });
  }

  let failed = false;

  console.log("");
  console.log("Checking Supabase auth settings...");
  try {
    const settings = await fetchAuthSettings(supabaseUrl, anonKey);
    if (!settings.ok) {
      console.warn(
        `! /auth/v1/settings failed (${settings.status}): ${typeof settings.body === "string" ? settings.body : JSON.stringify(settings.body)}`,
      );
    } else {
      const body =
        settings.body && typeof settings.body === "object"
          ? settings.body
          : {};
      const externalRaw =
        body.external || body.external_providers || body.providers || {};
      const external =
        externalRaw && typeof externalRaw === "object" ? externalRaw : {};

      console.log(`✓ /auth/v1/settings ok (${settings.status})`);
      if (Object.keys(external).length > 0) {
        console.log(`- external providers: ${Object.keys(external).join(", ")}`);
      }

      providers.forEach(provider => {
        const enabled = external[provider];
        if (typeof enabled !== "boolean") {
          failed = true;
          console.error(
            `✗ ${provider}: provider configuration not found in auth settings`,
          );
          return;
        }

        if (!enabled) {
          failed = true;
          console.error(`✗ ${provider}: provider is disabled in auth settings`);
          return;
        }

        console.log(`✓ ${provider}: provider enabled in auth settings`);
      });
    }
  } catch (error) {
    console.warn(
      `! /auth/v1/settings request failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  console.log("");
  console.log("Checking provider authorize flow...");

  for (const provider of providers) {
    try {
      const result = await checkAuthorize({
        supabaseUrl,
        anonKey,
        provider,
        redirectTo,
      });

      const isRedirect =
        result.status === 302 || result.status === 303 || result.status === 307;
      if (isRedirect && result.location) {
        const locationOrigin = toOrigin(result.location);
        console.log(
          `✓ ${provider}: authorize redirect (${result.status}) -> ${locationOrigin || result.location}`,
        );
      } else {
        failed = true;
        const bodyText =
          typeof result.body === "string"
            ? result.body
            : JSON.stringify(result.body);
        console.error(
          `✗ ${provider}: authorize failed (${result.status}) ${bodyText}`,
        );
      }
    } catch (error) {
      failed = true;
      console.error(
        `✗ ${provider}: request error ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  console.log("");
  if (failed) {
    console.error("Failed: one or more OAuth provider checks did not pass.");
    process.exit(1);
  }

  console.log("Passed: OAuth provider authorize checks look healthy.");
}

main().catch(error => {
  console.error(
    "OAuth check failed:",
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});
