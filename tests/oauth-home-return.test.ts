import { NextRequest } from "next/server";

import { describe, expect, it } from "vitest";

import { config, middleware } from "../middleware";

describe("OAuth responses returned to the site URL", () => {
  it.each([
    "code=example-code&next=%2Fmy-story%2F753",
    "error=access_denied&error_description=Login+cancelled",
    "error_code=bad_oauth_state",
    "error_description=OAuth+state+has+expired",
  ])("hands the complete query to the existing callback: %s", query => {
    const response = middleware(
      new NextRequest(`https://hodam.vercel.app/?${query}`),
    );
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      `https://hodam.vercel.app/auth/callback?${query}`,
    );
  });

  it.each(["", "?utm_source=search", "?code=&error=%20"])(
    "leaves an ordinary home visit alone: %s",
    query => {
      const response = middleware(
        new NextRequest(`https://hodam.vercel.app/${query}`),
      );
      expect(response.headers.get("location")).toBeNull();
      expect(response.headers.get("x-middleware-next")).toBe("1");
    },
  );

  it("never uses a query parameter as the redirect destination", () => {
    const response = middleware(
      new NextRequest(
        "https://hodam.vercel.app/?code=example&next=https%3A%2F%2Fevil.example",
      ),
    );
    const destination = new URL(response.headers.get("location")!);
    expect(destination.origin).toBe("https://hodam.vercel.app");
    expect(destination.pathname).toBe("/auth/callback");
  });

  it.each(["/auth/callback", "/sample", "/api/v1/threads"])(
    "does not redirect other paths or loop the callback: %s",
    path => {
      const response = middleware(
        new NextRequest(`https://hodam.vercel.app${path}?code=example`, {
          headers: { "x-request-id": "oauth-return-qa" },
        }),
      );
      expect(response.headers.get("location")).toBeNull();
      expect(response.headers.get("x-request-id")).toBe("oauth-return-qa");
      expect(response.headers.get("x-middleware-request-x-request-id")).toBe(
        "oauth-return-qa",
      );
    },
  );

  it("does not redirect non-GET requests", () => {
    const response = middleware(
      new NextRequest("https://hodam.vercel.app/?code=example", {
        method: "POST",
      }),
    );
    expect(response.headers.get("location")).toBeNull();
  });

  it("runs on the fallback home URL and retains the API matcher", () => {
    expect(config.matcher).toEqual(["/", "/api/v1/:path*"]);
  });
});
