import fs from "fs";
import path from "path";

export function parseEnvFile(content) {
  const result = {};
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const equalIndex = line.indexOf("=");
    if (equalIndex <= 0) continue;

    const key = line.slice(0, equalIndex).trim();
    const rawValue = line.slice(equalIndex + 1).trim();
    const unquotedValue =
      rawValue.startsWith('"') && rawValue.endsWith('"')
        ? rawValue.slice(1, -1)
        : rawValue.startsWith("'") && rawValue.endsWith("'")
          ? rawValue.slice(1, -1)
          : rawValue;

    result[key] = unquotedValue;
  }

  return result;
}

export function getEnvFileOrder(nodeEnv = "development") {
  return [".env", `.env.${nodeEnv}`, ".env.local", `.env.${nodeEnv}.local`];
}

export function loadLocalEnv({
  cwd = process.cwd(),
  nodeEnv = process.env.NODE_ENV || "development",
} = {}) {
  const merged = {};
  const loaded = [];
  const envFilesInOrder = getEnvFileOrder(nodeEnv);

  for (const fileName of envFilesInOrder) {
    const fullPath = path.join(cwd, fileName);
    if (!fs.existsSync(fullPath)) continue;

    Object.assign(merged, parseEnvFile(fs.readFileSync(fullPath, "utf8")));
    loaded.push(fullPath);
  }

  return { merged, loaded };
}

export function readEnvValue(name, {
  processEnv = process.env,
  fileEnv = {},
  fallback = "",
} = {}) {
  const processValue = processEnv[name];
  if (typeof processValue === "string" && processValue.trim()) {
    return processValue.trim();
  }

  const fileValue = fileEnv[name];
  if (typeof fileValue === "string" && fileValue.trim()) {
    return fileValue.trim();
  }

  return fallback;
}
