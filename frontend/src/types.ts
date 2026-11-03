export type Page =
  "overview" | "library" | "research" | "reports" | "settings" | "admin";
export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "member";
  is_active: boolean;
  created_at: string;
}
export interface Project {
  id: string;
  name: string;
  description: string;
  created_at: string;
  document_count: number;
  task_count: number;
}
export interface SourceDocument {
  category?: string;
  tags?: string[];
  language?: string;
  id: string;
  project_id: string;
  name: string;
  media_type: string;
  size: number;
  status: "ready" | "failed";
  error: string;
  summary: string;
  chunk_count: number;
  created_at: string;
}
export interface Chunk {
  id: string;
  text: string;
  location: string;
}
export interface DocumentDetail extends SourceDocument {
  chunks: Chunk[];
}
export interface Evidence {
  id: string;
  title: string;
  text: string;
  location: string;
  url: string | null;
  source_type: "document" | "web";
  document_id: string | null;
  score: number;
}
export interface Task {
  id: string;
  project_id: string;
  title: string;
  instructions: string;
  language: "zh" | "en";
  report_type: "research" | "review" | "brief";
  web_enabled: boolean;
  max_rounds: number;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  stage: string;
  round: number;
  coverage: number;
  mode: "extractive" | "llm";
  error: string;
  created_at: string;
  updated_at: string;
  report_id: string | null;
}
export interface TaskEvent {
  id: string;
  kind: string;
  message: string;
  created_at: string;
  data: Record<string, unknown>;
}
export interface TaskDetail extends Task {
  events: TaskEvent[];
  evidence: Evidence[];
  gaps: string[];
  outline: string[];
}
export interface Report {
  id: string;
  task_id: string;
  title: string;
  content: string;
  version: number;
  created_at: string;
  updated_at: string;
  evidence: Evidence[];
}
export interface Capabilities {
  llm_configured: boolean;
  search_configured: boolean;
  mode: string;
  embedding_mode: string;
}
export interface SystemSettings {
  llm_base_url: string;
  llm_model: string;
  embedding_model: string;
  search_provider: string;
  search_max_results: number;
  max_upload_mb: number;
  llm_configured: boolean;
  search_configured: boolean;
}
