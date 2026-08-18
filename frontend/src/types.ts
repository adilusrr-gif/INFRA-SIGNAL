export type AssetState = "normal" | "degraded" | "critical" | "offline";
export type Severity = "low" | "medium" | "high" | "critical";

export interface InfrastructureAsset {
  id: string;
  external_id: string;
  name: string;
  asset_type: string;
  latitude: number;
  longitude: number;
  commissioned_year: number;
  district: string;
  state: AssetState;
  criticality: number;
  properties: Record<string, string | number | boolean>;
}

export interface Evidence {
  id: string;
  kind: string;
  source_id: string;
  label: string;
  detail: string;
  observed_at: string;
  weight: number;
  metadata: Record<string, string | number | boolean | null>;
}

export interface Recommendation {
  id: string;
  order: number;
  title: string;
  action: string;
  source: string;
  section: string;
  requires_human_approval: boolean;
}

export interface Incident {
  id: string;
  incident_type: string;
  title: string;
  asset_id: string;
  latitude: number;
  longitude: number;
  detected_at: string;
  updated_at: string;
  severity: Severity;
  status: string;
  risk_score: number;
  confidence: number;
  probable_cause: string;
  affected_radius_meters: number;
  evidence: Evidence[];
  recommendations: Recommendation[];
  recommended_crew_id: string | null;
  assigned_crew_id: string | null;
}

export interface Crew {
  id: string;
  name: string;
  specialization: string[];
  latitude: number;
  longitude: number;
  status: string;
  phone: string;
}

export interface TelemetrySample {
  id: string;
  asset_id: string;
  metric: string;
  value: number;
  unit: string;
  captured_at: string;
  source: string;
}

export interface CitizenReport {
  id: string;
  text: string;
  channel: string;
  latitude: number;
  longitude: number;
  address: string;
  created_at: string;
  language: string;
  incident_type: string;
  urgency_score: number;
  summary: string;
  source_reference: string | null;
}

export interface TimelineEvent {
  id: string;
  kind: string;
  title: string;
  detail: string;
  happened_at: string;
  related_id: string | null;
}

export interface DashboardKpis {
  open_incidents: number;
  confirmed_incidents: number;
  critical_incidents: number;
  signals_processed: number;
  average_confidence: number;
}

export interface AiStatus {
  enabled: boolean;
  available: boolean;
  model: string;
  detail: string;
}

export interface DashboardData {
  generated_at: string;
  kpis: DashboardKpis;
  assets: InfrastructureAsset[];
  incidents: Incident[];
  crews: Crew[];
  reports: CitizenReport[];
  telemetry: TelemetrySample[];
  timeline: TimelineEvent[];
  ai: AiStatus;
}
