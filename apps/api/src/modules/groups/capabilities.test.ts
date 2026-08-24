import assert from "node:assert/strict";
import test from "node:test";
import { hasGroupCapability } from "./capabilities.js";

void test("group capabilities keep ownership authority server-side", () => {
  assert.equal(
    hasGroupCapability("OWNER", [], "GROUP_TRANSFER_OWNERSHIP"),
    true,
  );
  assert.equal(
    hasGroupCapability(
      "MODERATOR",
      ["GROUP_MANAGE_MEMBERS"],
      "GROUP_MANAGE_MEMBERS",
    ),
    true,
  );
  assert.equal(
    hasGroupCapability("MODERATOR", [], "GROUP_MANAGE_MEMBERS"),
    false,
  );
  assert.equal(
    hasGroupCapability("MODERATOR", [], "GROUP_TRANSFER_OWNERSHIP"),
    false,
  );
  assert.equal(
    hasGroupCapability(
      "MEMBER",
      ["GROUP_MANAGE_MEMBERS"],
      "GROUP_MANAGE_MEMBERS",
    ),
    false,
  );
});
