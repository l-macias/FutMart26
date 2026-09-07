import assert from "node:assert/strict";
import test from "node:test";

import { AdminErrorBuffer } from "./admin-error-buffer.js";

void test("admin error buffer is bounded and never retains supplied secret material", () => {
  const buffer = new AdminErrorBuffer(2);
  for (const [index, secret] of [
    "Authorization: Bearer secret",
    "Cookie=session-token",
    "password=hunter2 resetToken=reset accessKey=key secretKey=secret",
  ].entries()) {
    buffer.record({
      id: String(index),
      timestamp: new Date(index).toISOString(),
      requestId: `request-${index}`,
      method: "POST",
      route: "/safe-route",
      status: 500,
      durationMs: 12,
      errorCode: "internal_server_error",
      safeMessage: secret,
    });
  }
  const serialized = JSON.stringify(buffer.list({ limit: 20 }));
  assert.equal(buffer.list({ limit: 20 }).length, 2);
  assert.deepEqual(
    buffer
      .list({ limit: 20, from: new Date(2) })
      .map((event) => event.requestId),
    ["request-2"],
  );
  for (const forbidden of [
    "Bearer secret",
    "session-token",
    "hunter2",
    "reset",
    "accessKey",
    "secretKey",
  ])
    assert.equal(serialized.includes(forbidden), false);
});
