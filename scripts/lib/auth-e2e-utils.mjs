function parseBooleanLike(value) {
  if (!value || typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return null;
}

export function isCiLikeEnvironment(processEnv = process.env) {
  const ci = parseBooleanLike(processEnv.CI);
  if (ci === true) {
    return true;
  }

  const githubActions = parseBooleanLike(processEnv.GITHUB_ACTIONS);
  return githubActions === true;
}

export function shouldRequireAuthFlow({
  explicitValue = "",
  processEnv = process.env,
} = {}) {
  const explicit = parseBooleanLike(explicitValue);
  if (explicit !== null) {
    return explicit;
  }

  return isCiLikeEnvironment(processEnv);
}

