export interface HealthResponse {
  status: "ok";
}

export interface ReadyResponse {
  status: "ready" | "not_ready";
}
