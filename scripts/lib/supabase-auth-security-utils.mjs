export function parseBoolean(value, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "n", "off"].includes(normalized)) {
    return false;
  }

  throw new Error(`Invalid boolean value: ${value}`);
}

export function parsePositiveInteger(value, fallback, fieldName) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(
      `${fieldName} must be a positive integer. Received: ${value}`,
    );
  }
  return parsed;
}

export function toAuthSecurityState(config) {
  if (!config || typeof config !== "object") {
    return {
      mailerOtpExp: null,
      passwordHibpEnabled: null,
    };
  }

  const otpRaw = config.mailer_otp_exp;
  const hibpRaw = config.password_hibp_enabled;

  const mailerOtpExp =
    typeof otpRaw === "number" && Number.isFinite(otpRaw)
      ? Math.trunc(otpRaw)
      : null;
  const passwordHibpEnabled = typeof hibpRaw === "boolean" ? hibpRaw : null;

  return {
    mailerOtpExp,
    passwordHibpEnabled,
  };
}

export function createAuthSecurityPlan(currentConfig, target) {
  const current = toAuthSecurityState(currentConfig);
  const patch = {};
  const changes = [];

  if (current.mailerOtpExp !== target.mailerOtpExp) {
    patch.mailer_otp_exp = target.mailerOtpExp;
    changes.push({
      field: "mailer_otp_exp",
      current: current.mailerOtpExp,
      target: target.mailerOtpExp,
    });
  }

  if (current.passwordHibpEnabled !== target.passwordHibpEnabled) {
    patch.password_hibp_enabled = target.passwordHibpEnabled;
    changes.push({
      field: "password_hibp_enabled",
      current: current.passwordHibpEnabled,
      target: target.passwordHibpEnabled,
    });
  }

  return {
    current,
    target,
    patch,
    changes,
    hasChanges: changes.length > 0,
  };
}

