import { describe, expect, it } from "vitest";

import {
  createAuthSecurityPlan,
  parseBoolean,
  parsePositiveInteger,
  toAuthSecurityState,
} from "./supabase-auth-security-utils.mjs";

describe("supabase-auth-security-utils", () => {
  describe("parseBoolean", () => {
    it("parses truthy values", () => {
      expect(parseBoolean("true", false)).toBe(true);
      expect(parseBoolean("YES", false)).toBe(true);
      expect(parseBoolean("1", false)).toBe(true);
    });

    it("parses falsy values", () => {
      expect(parseBoolean("false", true)).toBe(false);
      expect(parseBoolean("no", true)).toBe(false);
      expect(parseBoolean("0", true)).toBe(false);
    });

    it("returns fallback when value is empty", () => {
      expect(parseBoolean("", true)).toBe(true);
      expect(parseBoolean(undefined, false)).toBe(false);
    });

    it("throws for invalid value", () => {
      expect(() => parseBoolean("maybe", true)).toThrow(
        "Invalid boolean value",
      );
    });
  });

  describe("parsePositiveInteger", () => {
    it("parses valid integer", () => {
      expect(parsePositiveInteger("3600", 100, "otp")).toBe(3600);
    });

    it("returns fallback when empty", () => {
      expect(parsePositiveInteger("", 100, "otp")).toBe(100);
    });

    it("throws for invalid integer", () => {
      expect(() => parsePositiveInteger("-1", 100, "otp")).toThrow(
        "otp must be a positive integer",
      );
      expect(() => parsePositiveInteger("1.5", 100, "otp")).toThrow(
        "otp must be a positive integer",
      );
    });
  });

  describe("toAuthSecurityState", () => {
    it("extracts auth security fields", () => {
      expect(
        toAuthSecurityState({
          mailer_otp_exp: 86400,
          password_hibp_enabled: false,
          other: "ignored",
        }),
      ).toEqual({
        mailerOtpExp: 86400,
        passwordHibpEnabled: false,
      });
    });

    it("returns null fields for invalid config", () => {
      expect(toAuthSecurityState(null)).toEqual({
        mailerOtpExp: null,
        passwordHibpEnabled: null,
      });
    });
  });

  describe("createAuthSecurityPlan", () => {
    it("returns no-op plan when current matches target", () => {
      const plan = createAuthSecurityPlan(
        { mailer_otp_exp: 3600, password_hibp_enabled: true },
        { mailerOtpExp: 3600, passwordHibpEnabled: true },
      );

      expect(plan.hasChanges).toBe(false);
      expect(plan.changes).toEqual([]);
      expect(plan.patch).toEqual({});
    });

    it("creates patch for changed fields", () => {
      const plan = createAuthSecurityPlan(
        { mailer_otp_exp: 86400, password_hibp_enabled: false },
        { mailerOtpExp: 3600, passwordHibpEnabled: true },
      );

      expect(plan.hasChanges).toBe(true);
      expect(plan.patch).toEqual({
        mailer_otp_exp: 3600,
        password_hibp_enabled: true,
      });
      expect(plan.changes).toEqual([
        {
          field: "mailer_otp_exp",
          current: 86400,
          target: 3600,
        },
        {
          field: "password_hibp_enabled",
          current: false,
          target: true,
        },
      ]);
    });
  });
});

