export interface N8nNodePosition {
  0: number;
  1: number;
}

export interface N8nNodeCredential {
  id: string;
  name: string;
}

export interface N8nNode {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  parameters: Record<string, unknown>;
  credentials?: Record<string, N8nNodeCredential>;
  webhookId?: string;
}

export interface N8nConnectionTarget {
  node: string;
  type: "main";
  index: number;
}

export type N8nConnections = Record<
  string,
  { main: N8nConnectionTarget[][] }
>;

export interface N8nWorkflowMeta {
  templateId?: string;
  n8nVersion?: string;
  [key: string]: unknown;
}

export interface N8nWorkflow {
  name: string;
  meta: N8nWorkflowMeta;
  nodes: N8nNode[];
  connections: N8nConnections;
  active: boolean;
  settings: Record<string, unknown>;
  staticData: null | Record<string, unknown>;
  pinData: Record<string, unknown>;
}

export type ArchetypeId =
  | "scheduled-scrape-summarize-notify"
  | "webhook-enrich-store"
  | "form-to-crm"
  | "inbound-email-triage"
  | "rag-faq-skeleton";

export interface PlaceholderMap {
  [placeholder: string]: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
