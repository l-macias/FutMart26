import assert from "node:assert/strict";
import test from "node:test";

import { authErrorMessage } from "./auth-errors.js";

void test("registration maps Better Auth duplicate-email codes without hiding other 422 errors", () => {
  const message =
    "Ya existe una cuenta con este correo. Iniciá sesión o recuperá tu contraseña.";

  assert.equal(
    authErrorMessage({
      code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
      status: 422,
    }),
    message,
  );
  assert.equal(
    authErrorMessage({ code: "USER_ALREADY_EXISTS", status: 422 }),
    message,
  );
  assert.equal(
    authErrorMessage({ code: "ANOTHER_422", status: 422 }),
    "No pudimos completar la operación. Intentá nuevamente.",
  );
});
