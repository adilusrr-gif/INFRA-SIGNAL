import type {
  DashboardData,
  GisImportIssue,
  GisImportResult,
  HealthStatus,
  Incident,
} from "../types";

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly issues: GisImportIssue[] = [],
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 20_000);
  const headers = new Headers(init?.headers);
  if (!(init?.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers,
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as
        | { detail?: string | { message?: string; issues?: GisImportIssue[] } }
        | null;
      const detail = typeof payload?.detail === "string"
        ? payload.detail
        : payload?.detail?.message ?? response.statusText;
      const issues = typeof payload?.detail === "object" ? payload.detail.issues ?? [] : [];
      throw new ApiRequestError(`${response.status}: ${detail}`, response.status, issues);
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Сервер не ответил за 20 секунд");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export const api = {
  health: () => request<HealthStatus>("/api/v1/health"),
  dashboard: () => request<DashboardData>("/api/v1/dashboard"),
  resetDemo: () => request<DashboardData>("/api/v1/demo/reset", { method: "POST" }),
  runLeakDemo: () =>
    request<DashboardData>("/api/v1/demo/water-leak", { method: "POST" }),
  assignCrew: (incidentId: string, crewId: string) =>
    request<Incident>(`/api/v1/incidents/${incidentId}/assign`, {
      method: "POST",
      body: JSON.stringify({ crew_id: crewId }),
    }),
  updateStatus: (incidentId: string, status: string) =>
    request<Incident>(`/api/v1/incidents/${incidentId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  importGis: (file: File, dryRun = true) => {
    const form = new FormData();
    form.append("file", file);
    form.append("dry_run", String(dryRun));
    return request<GisImportResult>("/api/v1/integrations/gis/import", {
      method: "POST",
      body: form,
    });
  },
};
