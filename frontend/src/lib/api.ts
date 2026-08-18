import type { DashboardData, Incident } from "../types";

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`${response.status}: ${detail}`);
    }
    return (await response.json()) as T;
  } finally {
    window.clearTimeout(timeout);
  }
}

export const api = {
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
};
