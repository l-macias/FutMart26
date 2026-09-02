export interface AuthClientError {
  code?: string;
  message?: string;
  status?: number;
}

export function authErrorMessage(error: AuthClientError | null | undefined) {
  if (!error) return "No pudimos completar la operación.";
  if (error.status === 429) {
    return "Hiciste demasiados intentos. Esperá un momento antes de volver a probar.";
  }

  switch (error.code) {
    case "EMAIL_NOT_VERIFIED":
      return "Verificá tu email antes de ingresar.";
    case "INVALID_TOKEN":
    case "TOKEN_EXPIRED":
      return "El enlace ya no es válido. Solicitá uno nuevo.";
    case "INVALID_PASSWORD":
      return "La contraseña actual no es correcta.";
    case "PASSWORD_TOO_SHORT":
      return "La contraseña debe tener al menos 12 caracteres.";
    case "PASSWORD_TOO_LONG":
      return "La contraseña no puede superar los 128 caracteres.";
    case "INVALID_EMAIL_OR_PASSWORD":
    case "USER_NOT_FOUND":
      return "Email o contraseña incorrectos.";
    case "SESSION_NOT_FRESH":
      return "Volvé a ingresar antes de cambiar datos sensibles de la cuenta.";
    default:
      return error.status === 401
        ? "Email o contraseña incorrectos."
        : "No pudimos completar la operación. Intentá nuevamente.";
  }
}

export function networkAuthErrorMessage(cause: unknown) {
  return cause instanceof TypeError
    ? "No pudimos conectar con el servidor. Verificá la conexión e intentá nuevamente."
    : "No pudimos completar la operación. Intentá nuevamente.";
}
