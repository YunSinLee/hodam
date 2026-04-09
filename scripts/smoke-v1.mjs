#!/usr/bin/env node

const args = new Set(process.argv.slice(2));

const baseUrl = (
  process.env.HODAM_API_BASE_URL || "http://localhost:3000"
).replace(/\/$/, "");
const accessToken = (process.env.HODAM_TEST_ACCESS_TOKEN || "").trim();
const runStory = args.has("--story");
const runTranslate = args.has("--translate");
const runPayments = args.has("--payments");
const runPaymentsConfirm =
  args.has("--payments-confirm") || process.env.HODAM_TEST_PAYMENT_CONFIRM === "1";
const runPaymentsWebhook =
  args.has("--payments-webhook") ||
  process.env.HODAM_TEST_PAYMENT_WEBHOOK === "1";
const skipThreadDetail = args.has("--skip-thread-detail");
const paymentPackageId = (
  process.env.HODAM_TEST_PAYMENT_PACKAGE_ID || "bead_5"
).trim();
const paymentKey = (process.env.HODAM_TEST_PAYMENT_KEY || "mock_payment_key").trim();

if (!accessToken) {
  console.error(
    "Missing HODAM_TEST_ACCESS_TOKEN. Please provide a valid bearer token.",
  );
  process.exit(1);
}

async function call(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  return { status: response.status, body, headers: response.headers };
}

async function expectOk(path, init) {
  const result = await call(path, init);
  if (result.status < 200 || result.status >= 300) {
    throw new Error(
      `${path} failed: ${result.status} ${JSON.stringify(result.body)}`,
    );
  }
  return result.body;
}

async function expectOkWithHeaders(path, init) {
  const result = await call(path, init);
  if (result.status < 200 || result.status >= 300) {
    throw new Error(
      `${path} failed: ${result.status} ${JSON.stringify(result.body)}`,
    );
  }

  return {
    body: result.body,
    headers: result.headers,
  };
}

async function main() {
  console.log(`HODAM v1 smoke test base=${baseUrl}`);

  const bead = await expectOk("/api/v1/beads", { method: "GET" });
  const threads = await expectOk("/api/v1/threads", { method: "GET" });
  const profile = await expectOk("/api/v1/profile/summary?limit=3", {
    method: "GET",
  });
  const payments = await expectOk("/api/v1/payments/history", {
    method: "GET",
  });

  console.log(
    `- beads ok (count=${bead?.bead?.count ?? "unknown"}) | threads ok (${Array.isArray(threads?.threads) ? threads.threads.length : "unknown"})`,
  );
  console.log(
    `- profile ok (${profile?.profile?.email || "no-email"}) | payments ok (${Array.isArray(payments?.payments) ? payments.payments.length : "unknown"})`,
  );

  if (runPayments) {
    const prepared = await expectOk("/api/v1/payments/prepare", {
      method: "POST",
      body: JSON.stringify({
        packageId: paymentPackageId,
      }),
    });

    const orderId = typeof prepared?.orderId === "string" ? prepared.orderId : "";
    const amount = Number(prepared?.amount || 0);

    if (!orderId || !Number.isFinite(amount) || amount <= 0) {
      throw new Error(
        `payment/prepare returned invalid payload: ${JSON.stringify(prepared)}`,
      );
    }

    console.log(
      `- payment prepare ok (orderId=${orderId}, amount=${amount}, package=${paymentPackageId})`,
    );

    if (runPaymentsWebhook) {
      const transmissionId = `smoke-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      const webhookPayload = {
        eventType: "PAYMENT_STATUS_CHANGED",
        data: {
          orderId,
          paymentKey,
          totalAmount: amount,
          status: "DONE",
        },
      };

      const webhookFirst = await expectOk("/api/v1/payments/webhook", {
        method: "POST",
        headers: {
          "tosspayments-webhook-transmission-id": transmissionId,
          "tosspayments-webhook-transmission-time": new Date().toISOString(),
          "tosspayments-webhook-transmission-retried-count": "0",
        },
        body: JSON.stringify(webhookPayload),
      });

      if (!webhookFirst?.received || webhookFirst?.ignored) {
        throw new Error(
          `payment/webhook first call must settle: ${JSON.stringify(webhookFirst)}`,
        );
      }

      const webhookDuplicate = await expectOk("/api/v1/payments/webhook", {
        method: "POST",
        headers: {
          "tosspayments-webhook-transmission-id": transmissionId,
          "tosspayments-webhook-transmission-time": new Date().toISOString(),
          "tosspayments-webhook-transmission-retried-count": "0",
        },
        body: JSON.stringify(webhookPayload),
      });

      if (
        !webhookDuplicate?.received ||
        webhookDuplicate?.reason !== "duplicate_event"
      ) {
        throw new Error(
          `payment/webhook duplicate call must be ignored: ${JSON.stringify(webhookDuplicate)}`,
        );
      }

      const reconciled = await expectOk(
        `/api/v1/payments/status?orderId=${encodeURIComponent(
          orderId,
        )}&paymentKey=${encodeURIComponent(paymentKey)}&amount=${amount}`,
        {
          method: "GET",
        },
      );

      if (reconciled?.status !== "completed") {
        throw new Error(
          `payment/status should be completed after webhook settlement: ${JSON.stringify(
            reconciled,
          )}`,
        );
      }

      console.log(`- payment webhook settlement ok (orderId=${orderId})`);
    }

    if (runPaymentsConfirm) {
      const expectFirstAlreadyProcessed = runPaymentsWebhook;
      const confirmedFirst = await expectOk("/api/v1/payments/confirm", {
        method: "POST",
        body: JSON.stringify({
          paymentKey,
          orderId,
          amount,
        }),
      });

      const firstAlreadyProcessed = Boolean(confirmedFirst?.alreadyProcessed);
      if (firstAlreadyProcessed !== expectFirstAlreadyProcessed) {
        throw new Error(
          `payment/confirm first call unexpected alreadyProcessed=${firstAlreadyProcessed} (expected=${expectFirstAlreadyProcessed}): ${JSON.stringify(
            confirmedFirst,
          )}`,
        );
      }

      const confirmedSecond = await expectOk("/api/v1/payments/confirm", {
        method: "POST",
        body: JSON.stringify({
          paymentKey,
          orderId,
          amount,
        }),
      });

      const secondAlreadyProcessed = Boolean(confirmedSecond?.alreadyProcessed);
      if (!secondAlreadyProcessed) {
        throw new Error(
          `payment/confirm second call must be idempotent(alreadyProcessed=true): ${JSON.stringify(confirmedSecond)}`,
        );
      }

      const firstBeadCount = Number(confirmedFirst?.beadCount || 0);
      const secondBeadCount = Number(confirmedSecond?.beadCount || 0);

      if (!Number.isFinite(firstBeadCount) || !Number.isFinite(secondBeadCount)) {
        throw new Error(
          `payment/confirm beadCount is invalid: first=${confirmedFirst?.beadCount} second=${confirmedSecond?.beadCount}`,
        );
      }

      if (firstBeadCount !== secondBeadCount) {
        throw new Error(
          `payment idempotency failed: beadCount changed on duplicate confirm (${firstBeadCount} -> ${secondBeadCount})`,
        );
      }

      const beforeBeadCount = Number(bead?.bead?.count || 0);
      const purchasedQuantity = Number(prepared?.package?.quantity || 0);
      if (
        Number.isFinite(beforeBeadCount) &&
        Number.isFinite(purchasedQuantity) &&
        purchasedQuantity > 0
      ) {
        const expectedAfterFirst = beforeBeadCount + purchasedQuantity;
        if (firstBeadCount !== expectedAfterFirst) {
          throw new Error(
            `payment credit mismatch: expected ${expectedAfterFirst}, got ${firstBeadCount}`,
          );
        }
      }

      const beadAfterConfirm = await expectOk("/api/v1/beads", { method: "GET" });
      const beadAfterCount = Number(beadAfterConfirm?.bead?.count || 0);
      if (beadAfterCount !== secondBeadCount) {
        throw new Error(
          `payment bead state mismatch: /beads=${beadAfterCount}, confirm=${secondBeadCount}`,
        );
      }

      console.log(
        `- payment confirm idempotency ok (orderId=${orderId}, beads=${secondBeadCount}, firstAlreadyProcessed=${firstAlreadyProcessed})`,
      );
    } else {
      console.log(
        "- payment confirm skipped (set --payments-confirm or HODAM_TEST_PAYMENT_CONFIRM=1 to include confirm)",
      );
    }

    const paymentHistoryAfter = await expectOk("/api/v1/payments/history", {
      method: "GET",
    });
    const hasPreparedOrder =
      Array.isArray(paymentHistoryAfter?.payments) &&
      paymentHistoryAfter.payments.some(item => {
        if (item?.order_id !== orderId) return false;
        if (!runPaymentsConfirm) return true;
        return item?.status === "completed";
      });

    if (!hasPreparedOrder) {
      throw new Error(
        `payment/history missing order or completed status: ${orderId}`,
      );
    }

    console.log(`- payment history reflects order state (orderId=${orderId})`);

    const timelineResponse = await expectOkWithHeaders(
      `/api/v1/payments/timeline?orderId=${encodeURIComponent(orderId)}`,
      {
        method: "GET",
      },
    );
    const timeline = timelineResponse.body;
    const timelineEventCount = Array.isArray(timeline?.events)
      ? timeline.events.length
      : 0;
    const timelineLookupMode =
      timelineResponse.headers.get("x-hodam-payment-timeline-lookup-mode") ||
      "";
    const timelineDegraded =
      timelineResponse.headers.get("x-hodam-payment-timeline-degraded") === "1";
    const timelineDegradedReason =
      timelineResponse.headers.get("x-hodam-payment-timeline-degraded-reason") ||
      "-";

    if (timeline?.orderId !== orderId || timelineEventCount < 1) {
      throw new Error(
        `payment/timeline invalid response for ${orderId}: ${JSON.stringify(timeline)}`,
      );
    }
    if (timelineLookupMode !== "order_id") {
      throw new Error(
        `payment/timeline lookup mode mismatch for order lookup: ${timelineLookupMode || "missing"}`,
      );
    }
    if (runPaymentsWebhook) {
      const hasWebhookEvent = timeline.events.some(
        event => event?.type === "webhook_received",
      );
      if (!hasWebhookEvent) {
        throw new Error(
          `payment/timeline missing webhook event for ${orderId}: ${JSON.stringify(timeline)}`,
        );
      }
    }

    console.log(
      `- payment timeline ok (orderId=${orderId}, events=${timelineEventCount}, lookup=${timelineLookupMode}, degraded=${timelineDegraded ? `yes:${timelineDegradedReason}` : "no"})`,
    );

    const flowIdFromTimeline =
      typeof timeline?.paymentFlowId === "string"
        ? timeline.paymentFlowId.trim()
        : "";
    if (flowIdFromTimeline) {
      const timelineByFlowResponse = await expectOkWithHeaders(
        `/api/v1/payments/timeline?paymentFlowId=${encodeURIComponent(
          flowIdFromTimeline,
        )}`,
        {
          method: "GET",
        },
      );
      const timelineByFlow = timelineByFlowResponse.body;
      const timelineByFlowLookupMode =
        timelineByFlowResponse.headers.get(
          "x-hodam-payment-timeline-lookup-mode",
        ) || "";

      if (timelineByFlow?.orderId !== orderId) {
        throw new Error(
          `payment/timeline(flow) order mismatch: expected=${orderId} actual=${timelineByFlow?.orderId}`,
        );
      }
      if (timelineByFlowLookupMode !== "payment_flow_id") {
        throw new Error(
          `payment/timeline lookup mode mismatch for flow lookup: ${timelineByFlowLookupMode || "missing"}`,
        );
      }

      console.log(
        `- payment timeline flow lookup ok (paymentFlowId=${flowIdFromTimeline}, lookup=${timelineByFlowLookupMode})`,
      );

      const timelineByFlowAliasResponse = await expectOkWithHeaders(
        `/api/v1/payments/timeline?flowId=${encodeURIComponent(
          flowIdFromTimeline,
        )}`,
        {
          method: "GET",
        },
      );
      const timelineByFlowAlias = timelineByFlowAliasResponse.body;
      const timelineByFlowAliasLookupMode =
        timelineByFlowAliasResponse.headers.get(
          "x-hodam-payment-timeline-lookup-mode",
        ) || "";

      if (timelineByFlowAlias?.orderId !== orderId) {
        throw new Error(
          `payment/timeline(flowId) order mismatch: expected=${orderId} actual=${timelineByFlowAlias?.orderId}`,
        );
      }
      if (timelineByFlowAliasLookupMode !== "payment_flow_id") {
        throw new Error(
          `payment/timeline lookup mode mismatch for flowId alias lookup: ${timelineByFlowAliasLookupMode || "missing"}`,
        );
      }

      console.log(
        `- payment timeline flowId alias lookup ok (flowId=${flowIdFromTimeline}, lookup=${timelineByFlowAliasLookupMode})`,
      );
    } else if (runPaymentsWebhook) {
      throw new Error(
        `payment/timeline missing paymentFlowId for ${orderId}: ${JSON.stringify(timeline)}`,
      );
    }
  }

  const listThreadId =
    Array.isArray(threads?.threads) && threads.threads.length > 0
      ? Number(threads.threads[0]?.id)
      : null;

  if (!skipThreadDetail && listThreadId && Number.isFinite(listThreadId)) {
    const threadDetail = await expectOk(`/api/v1/threads/${listThreadId}`, {
      method: "GET",
    });

    const messageCount = Array.isArray(threadDetail?.messages)
      ? threadDetail.messages.length
      : "unknown";
    console.log(`- thread detail ok (threadId=${listThreadId}, messages=${messageCount})`);
  }

  if (!runStory && !runPayments) {
    console.log("Smoke passed (read-only checks).");
    return;
  }

  if (!runStory && runPayments) {
    console.log(
      `Smoke passed (payments flow). confirm=${runPaymentsConfirm} package=${paymentPackageId}`,
    );
    return;
  }

  const started = await expectOk("/api/v1/story/start", {
    method: "POST",
    body: JSON.stringify({
      keywords: "용기, 우정",
      includeEnglish: false,
      includeImage: false,
    }),
  });

  const threadId = Number(started?.threadId);
  const firstSelection = started?.selections?.[0]?.text || "앞으로 걸어간다";
  if (!Number.isFinite(threadId) || threadId <= 0) {
    throw new Error(`story/start returned invalid threadId: ${threadId}`);
  }

  await expectOk("/api/v1/story/continue", {
    method: "POST",
    body: JSON.stringify({
      threadId,
      selection: firstSelection,
    }),
  });

  if (!skipThreadDetail) {
    const threadDetail = await expectOk(`/api/v1/threads/${threadId}`, {
      method: "GET",
    });
    const messageCount = Array.isArray(threadDetail?.messages)
      ? threadDetail.messages.length
      : "unknown";
    console.log(
      `- thread detail ok after continue (threadId=${threadId}, messages=${messageCount})`,
    );
  }

  if (runTranslate) {
    await expectOk("/api/v1/story/translate", {
      method: "POST",
      body: JSON.stringify({ threadId }),
    });
  }

  console.log(`Smoke passed (story flow). threadId=${threadId} translate=${runTranslate} payments=${runPayments}`);
}

main().catch(error => {
  console.error(
    "Smoke failed:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
