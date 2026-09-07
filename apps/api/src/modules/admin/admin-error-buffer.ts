export interface AdminErrorEvent {
  id: string;
  timestamp: string;
  requestId: string;
  method: string;
  route: string;
  status: number;
  durationMs: number;
  errorCode: string;
  safeMessage: string;
}

export class AdminErrorBuffer {
  private readonly events: AdminErrorEvent[] = [];

  constructor(private readonly capacity = 200) {}

  record(event: AdminErrorEvent) {
    this.events.unshift({
      ...event,
      safeMessage: safeErrorMessage(event.status),
    });
    if (this.events.length > this.capacity) this.events.length = this.capacity;
  }

  list(input: {
    limit: number;
    status?: number;
    route?: string;
    errorCode?: string;
    from?: Date;
    to?: Date;
  }) {
    const route = input.route?.trim().toLowerCase();
    const code = input.errorCode?.trim().toLowerCase();
    return this.events
      .filter(
        (event) =>
          (!input.status || event.status === input.status) &&
          (!route || event.route.toLowerCase().includes(route)) &&
          (!code || event.errorCode.toLowerCase().includes(code)) &&
          (!input.from || new Date(event.timestamp) >= input.from) &&
          (!input.to || new Date(event.timestamp) <= input.to),
      )
      .slice(0, input.limit)
      .map((event) => ({ ...event }));
  }
}

export function safeErrorMessage(status: number) {
  if (status >= 500) return "Error interno procesado de forma segura.";
  if (status === 404) return "El recurso solicitado no está disponible.";
  if (status === 403) return "La operación fue rechazada por autoridad.";
  if (status === 401) return "La solicitud no tenía una sesión válida.";
  if (status === 409)
    return "La operación entró en conflicto con el estado actual.";
  return "La solicitud no pudo completarse.";
}
