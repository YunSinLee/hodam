#!/usr/bin/env node

import http from "http";
import { URL } from "url";

function readArgValue(prefix) {
  const raw = process.argv.find(item => item.startsWith(`${prefix}=`));
  if (!raw) return "";
  return raw.slice(prefix.length + 1).trim();
}

const portArg = Number(readArgValue("--port"));
const port = Number.isFinite(portArg) && portArg > 0 ? portArg : 4010;

const defaultStatus = process.env.MOCK_TOSS_STATUS || "DONE";
const defaultCurrency = process.env.MOCK_TOSS_CURRENCY || "KRW";
const expectedSecret = process.env.MOCK_TOSS_SECRET || "";
const requireAuth = process.env.MOCK_TOSS_REQUIRE_AUTH === "1";
const authUser = process.env.MOCK_TOSS_AUTH_USER || "";
const authPass = process.env.MOCK_TOSS_AUTH_PASS || "";

const confirmedByOrder = new Map();

function json(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("error", reject);
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8").trim();
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("invalid json"));
      }
    });
  });
}

function decodeBasicAuth(authorization) {
  if (!authorization || !authorization.startsWith("Basic ")) {
    return { user: "", pass: "" };
  }

  const encoded = authorization.slice("Basic ".length);
  const decoded = Buffer.from(encoded, "base64").toString("utf8");
  const separatorIndex = decoded.indexOf(":");
  if (separatorIndex < 0) {
    return { user: decoded, pass: "" };
  }

  return {
    user: decoded.slice(0, separatorIndex),
    pass: decoded.slice(separatorIndex + 1),
  };
}

function isAuthorized(req) {
  if (!requireAuth) return true;
  const auth = decodeBasicAuth(req.headers.authorization || "");
  return auth.user === authUser && auth.pass === authPass;
}

const server = http.createServer(async (req, res) => {
  const method = req.method || "GET";
  const requestUrl = new URL(req.url || "/", `http://localhost:${port}`);
  const pathname = requestUrl.pathname;

  if (method === "GET" && pathname === "/health") {
    json(res, 200, {
      ok: true,
      service: "mock-toss-server",
      port,
      requireAuth,
      storedOrders: confirmedByOrder.size,
    });
    return;
  }

  if (!isAuthorized(req)) {
    json(res, 401, {
      code: "UNAUTHORIZED",
      message: "Mock Toss auth failed",
    });
    return;
  }

  if (method === "POST" && pathname === "/v1/payments/confirm") {
    try {
      const body = await parseBody(req);
      const paymentKey = String(body.paymentKey || "").trim();
      const orderId = String(body.orderId || "").trim();
      const amount = Number(body.amount);

      if (!paymentKey || !orderId || !Number.isFinite(amount) || amount <= 0) {
        json(res, 400, {
          code: "INVALID_REQUEST",
          message: "paymentKey, orderId, amount are required",
        });
        return;
      }

      if (paymentKey.startsWith("fail_")) {
        json(res, 400, {
          code: "FAILED_PAYMENT_INTERNAL_SYSTEM_PROCESSING",
          message: "mock confirm forced failure",
        });
        return;
      }

      const payload = {
        mId: "mock-mid",
        paymentKey,
        orderId,
        orderName: "mock-order",
        status: defaultStatus,
        requestedAt: new Date().toISOString(),
        approvedAt: new Date().toISOString(),
        useEscrow: false,
        cultureExpense: false,
        card: null,
        virtualAccount: null,
        transfer: null,
        mobilePhone: null,
        giftCertificate: null,
        cashReceipt: null,
        cashReceipts: null,
        discount: null,
        cancels: [],
        secret: expectedSecret || undefined,
        type: "NORMAL",
        easyPay: {
          provider: "TOSS",
          amount,
          discountAmount: 0,
        },
        totalAmount: amount,
        balanceAmount: amount,
        suppliedAmount: amount,
        vat: 0,
        taxFreeAmount: 0,
        method: "카드",
        currency: defaultCurrency,
      };

      confirmedByOrder.set(orderId, payload);
      json(res, 200, payload);
      return;
    } catch (error) {
      json(res, 400, {
        code: "INVALID_JSON",
        message: "mock server could not parse json body",
      });
      return;
    }
  }

  if (method === "GET" && pathname.startsWith("/v1/payments/orders/")) {
    const orderId = decodeURIComponent(
      pathname.slice("/v1/payments/orders/".length),
    );
    const stored = confirmedByOrder.get(orderId);

    if (!stored) {
      json(res, 404, {
        code: "NOT_FOUND_PAYMENT",
        message: "mock order not found",
      });
      return;
    }

    json(res, 200, stored);
    return;
  }

  json(res, 404, {
    code: "NOT_FOUND",
    message: `No route for ${method} ${pathname}`,
  });
});

server.listen(port, () => {
  console.log(
    `[mock-toss] listening on http://localhost:${port} (requireAuth=${requireAuth})`,
  );
});

server.on("error", error => {
  console.error(
    `[mock-toss] server error: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exit(1);
});
