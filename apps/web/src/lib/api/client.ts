import type { ZodType } from "zod";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function mediaContentUrl(path: string) {
  return `${apiBaseUrl}${path}`;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(userMessageForApiError(code, status));
    this.name = "ApiError";
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { schema?: ZodType<T> } = {},
): Promise<T> {
  const isMultipart =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        ...(options.body && !isMultipart
          ? { "content-type": "application/json" }
          : {}),
        ...options.headers,
      },
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError")
      throw cause;
    throw new ApiError(0, "network_error");
  }
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
      details?: Record<string, unknown>;
    } | null;
    throw new ApiError(
      response.status,
      payload?.error ?? "unknown_error",
      payload?.details,
    );
  }
  if (response.status === 204) return undefined as T;
  const payload: unknown = await response.json();
  return options.schema ? options.schema.parse(payload) : (payload as T);
}

export function userMessageForApiError(code: string, status = 0) {
  const messages: Record<string, string> = {
    unauthenticated: "Tu sesión terminó. Volvé a ingresar.",
    forbidden: "No tenés permiso para realizar esta acción.",
    invitation_not_available: "Esta invitación ya no está disponible.",
    member_blocked: "No podés ingresar a este grupo.",
    already_member: "Ya sos miembro de este grupo.",
    group_not_found: "No encontramos ese grupo.",
    match_not_found: "No encontramos ese partido.",
    invalid_match_transition:
      "Esa acción ya no está disponible en el estado actual del partido.",
    match_not_open: "La convocatoria ya no admite inscripciones.",
    roster_locked: "El roster quedó bloqueado al iniciar el partido.",
    capacity_below_confirmed:
      "El cupo no puede ser menor que la cantidad de participantes confirmados.",
    incomplete_team_assignments:
      "Todos los participantes confirmados deben tener equipo antes de iniciar.",
    teams_locked: "Los equipos quedaron bloqueados al iniciar el partido.",
    invalid_team_assignment:
      "Los equipos deben incluir una sola vez a cada participante confirmado.",
    prior_match_sporting_closure_required:
      "Cerrá primero el partido anterior pendiente antes de publicar esta convocatoria.",
    voting_not_open: "La votación ya no está abierta.",
    voter_not_eligible: "No sos elegible para votar en este partido.",
    ballot_already_submitted: "Tu voto ya fue enviado.",
    invalid_ballot: "Revisá las evaluaciones antes de enviar tu voto.",
    active_matches_prevent_archive:
      "Resolvé los partidos Draft, Open o Started antes de archivar el grupo.",
    network_error: "No pudimos conectar con el servidor. Intentá nuevamente.",
    invalid_sporting_result:
      "Los goles o asistencias cargados no coinciden con el resultado.",
    sporting_result_not_ready:
      "Completá la asistencia, el resultado y las estadísticas antes de finalizar.",
    stats_not_allowed:
      "Un jugador ausente no puede tener goles ni asistencias.",
    invalid_final_roster:
      "El partido cambió mientras lo estabas editando. Actualizá los datos.",
    invalid_recruitment:
      "Las necesidades deben usar cantidades válidas y no superar los lugares disponibles.",
    sporting_result_locked:
      "El cierre deportivo ya no puede corregirse porque la votación fue abierta.",
    media_too_large: "La foto puede pesar hasta 8 MB.",
    media_format_not_allowed: "Usá una imagen JPEG, PNG o WebP válida.",
    media_dimensions_invalid:
      "La foto es demasiado pequeña. Usá una imagen de al menos 320 × 320.",
    media_processing_failed:
      "No pudimos procesar esa imagen. Probá con otro archivo.",
    invalid_media_upload: "Seleccioná una sola imagen válida.",
    media_storage_unavailable:
      "El servicio de imágenes no está disponible. Tu foto anterior sigue intacta.",
    media_feature_unavailable:
      "La carga de imágenes todavía no está configurada en este entorno.",
    media_rate_limited:
      "Hiciste demasiados intentos. Esperá unos minutos antes de subir otra foto.",
    compliance_required:
      "Completá la verificación de edad y privacidad antes de continuar.",
    underage: "Esta beta está disponible sólo para mayores de 18 años.",
    date_of_birth_locked:
      "La fecha ya fue confirmada. Contactá a soporte si necesitás corregirla.",
    report_rate_limited:
      "Alcanzaste el límite temporal de reportes. Intentá más tarde.",
    report_target_not_found:
      "No pudimos identificar este recurso para reportarlo.",
    account_deletion_requires_group_resolution:
      "Transferí tus grupos o resolvé sus partidos activos antes de eliminar la cuenta.",
    account_suspended:
      "El acceso de esta cuenta está suspendido. Contactá a soporte.",
  };
  return (
    messages[code] ??
    (status >= 500
      ? "El servidor no pudo completar la operación. Intentá nuevamente."
      : "No pudimos completar la operación.")
  );
}
