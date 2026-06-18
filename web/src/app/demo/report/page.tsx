// ponytail: static fixture page — no Supabase, no auth. Remove before production if desired.
import { ReportViewer } from "@/components/report-viewer";
import type { Database } from "@/lib/db-types";

type ReportRow = Database["public"]["Tables"]["reports"]["Row"];

const DEMO_RUN_ID = "00000000-demo-0000-0000-northbound001";

const DEMO_REPORT: ReportRow = {
  id: "00000000-demo-0000-0000-report000001",
  org_id: "00000000-demo-0000-0000-org000000001",
  run_id: DEMO_RUN_ID,
  version: 1,
  status: "published",
  summary:
    "NorthBound Solutions is a 120-person professional services firm (London / New York / Singapore) serving regulated financial-services clients. The highest-impact automation opportunity is eliminating 40+ manual reconciliation steps from the 12-day month-end close cycle. Three additional opportunities exist in regulatory-change alerting, engagement onboarding, and client reporting.",
  business_profile: {
    name: "NorthBound Solutions",
    industry: "Professional Services — Financial Regulatory Consulting",
    size: "120 consultants, three offices (London / New York / Singapore)",
    description:
      "Mid-market consulting firm delivering regulatory compliance, finance transformation, operations efficiency, and risk management engagements to banking, insurance, and asset management clients.",
    primaryServices: [
      "Regulatory Compliance — gap analysis, policy drafting, monitoring",
      "Finance Transformation — month-end close, reconciliation automation",
      "Operations Efficiency — process mapping, workflow digitisation",
      "Risk Management — enterprise risk frameworks, audit readiness",
    ],
    technologyIndicators: [
      "Microsoft 365",
      "SharePoint",
      "Microsoft Teams",
      "Power BI",
      "Power Automate (evaluating)",
      "Snowflake",
      "Excel",
    ],
    marketPosition:
      "ISO 27001 certified; 300+ engagements delivered; deep financial services regulatory expertise",
    evidenceSnippets: [
      "month-end close takes 12 days and involves 40+ manual reconciliation steps across three systems",
      "regulatory change notifications arrive by email and are tracked in a shared spreadsheet",
      "new engagement onboarding requires 6 approval steps across 4 departments via email chains",
    ],
  },
  opportunities: [
    {
      id: "opp-month-end-close",
      title: "Automated Month-End Close Reconciliation",
      description:
        "Replace 40+ manual reconciliation steps across three systems with an n8n workflow that pulls from Snowflake, runs variance checks, and routes exceptions. Target: 12-day close → 4 days.",
      pillar: "Operations & Efficiency",
      impactScore: 5,
      effortScore: 3,
      confidenceScore: 0.91,
      roiEstimate: "~£180k/yr saved (600 consultant-hours at blended rate)",
      evidenceCitations: [
        "month-end close takes 12 days and involves 40+ manual reconciliation steps across three systems",
      ],
      toolIds: ["n8n", "snowflake-connector", "microsoft-excel"],
      quadrant: "strategic",
      priority: 1,
    },
    {
      id: "opp-reg-alerting",
      title: "Regulatory Change Alerting Pipeline",
      description:
        "Replace the shared-spreadsheet tracking system with an automated pipeline: scrape regulatory feeds → diff against prior version → push alerts to Teams channels → log to SharePoint.",
      pillar: "Cybersecurity & Risk",
      impactScore: 4,
      effortScore: 2,
      confidenceScore: 0.87,
      roiEstimate: "~£40k/yr — eliminates missed-change risk and ~2 FTE-hours/week",
      evidenceCitations: [
        "regulatory change notifications arrive by email and are tracked in a shared spreadsheet — no alerting system",
      ],
      toolIds: ["n8n", "microsoft-teams", "sharepoint"],
      quadrant: "quick-win",
      priority: 2,
    },
    {
      id: "opp-onboarding",
      title: "Engagement Onboarding Approval Workflow",
      description:
        "Digitise the 6-step cross-department onboarding approval from email chains into a Power Automate → SharePoint → Teams workflow with SLA tracking.",
      pillar: "Operations & Efficiency",
      impactScore: 3,
      effortScore: 2,
      confidenceScore: 0.82,
      roiEstimate: "~£25k/yr — reduces onboarding from 5 days to under 1",
      evidenceCitations: [
        "new engagement onboarding requires 6 approval steps across 4 departments, all done via email chains",
      ],
      toolIds: ["power-automate", "microsoft-teams", "sharepoint"],
      quadrant: "quick-win",
      priority: 3,
    },
  ],
  ranked: [
    {
      id: "opp-month-end-close",
      title: "Automated Month-End Close Reconciliation",
      description:
        "Replace 40+ manual reconciliation steps with an n8n workflow. 12-day close → 4 days.",
      pillar: "Operations & Efficiency",
      impactScore: 5,
      effortScore: 3,
      confidenceScore: 0.91,
      roiEstimate: "~£180k/yr saved",
      evidenceCitations: ["month-end close takes 12 days — 40+ manual steps"],
      toolIds: ["n8n", "snowflake-connector", "microsoft-excel"],
      quadrant: "strategic",
      priority: 1,
    },
    {
      id: "opp-reg-alerting",
      title: "Regulatory Change Alerting Pipeline",
      description: "Automated pipeline: regulatory feeds → Teams alerts → SharePoint log.",
      pillar: "Cybersecurity & Risk",
      impactScore: 4,
      effortScore: 2,
      confidenceScore: 0.87,
      roiEstimate: "~£40k/yr",
      evidenceCitations: ["tracked in a shared spreadsheet — no alerting system"],
      toolIds: ["n8n", "microsoft-teams", "sharepoint"],
      quadrant: "quick-win",
      priority: 2,
    },
    {
      id: "opp-onboarding",
      title: "Engagement Onboarding Approval Workflow",
      description: "Digitise 6-step approval from email chains into Power Automate + Teams.",
      pillar: "Operations & Efficiency",
      impactScore: 3,
      effortScore: 2,
      confidenceScore: 0.82,
      roiEstimate: "~£25k/yr",
      evidenceCitations: ["6 approval steps across 4 departments via email chains"],
      toolIds: ["power-automate", "microsoft-teams", "sharepoint"],
      quadrant: "quick-win",
      priority: 3,
    },
  ],
  requirements: {
    opportunityId: "opp-month-end-close",
    title: "Month-End Close Automation — Requirements Brief",
    businessObjective:
      "Reduce the month-end close cycle from 12 days to 4 days by automating the 40+ manual reconciliation steps that currently span three systems (Snowflake, Excel, internal reporting tool).",
    scopeIn: [
      "Automated data extraction from Snowflake",
      "Variance detection and threshold alerting",
      "Exception routing to responsible analyst via Teams",
      "Audit-trail logging to SharePoint",
      "Final sign-off approval step",
    ],
    scopeOut: [
      "Changes to Snowflake data model",
      "ERP/GL system integration (phase 2)",
      "Client-facing reporting portal",
    ],
    constraints: [
      "ISO 27001 certification — all data must stay within EU/UK boundary",
      "No changes to existing Snowflake access-control policies",
      "Must integrate with existing Microsoft 365 tenant",
    ],
    successCriteria: [
      "Month-end close completes in ≤4 days (from 12)",
      "Zero manual reconciliation steps for standard variances",
      "Exception audit log complete and accessible in SharePoint",
      "≥95% of exceptions routed within 30 min of detection",
    ],
    stakeholders: [
      "CFO / Finance Director — business sponsor",
      "Head of Operations — workflow owner",
      "IT / M365 admin — tenant access",
      "Compliance lead — audit requirements",
    ],
  },
  solution_design: {
    opportunityId: "opp-month-end-close",
    architecture:
      "n8n scheduled workflow (nightly + on-demand) extracts reconciliation data from Snowflake via the native connector, runs variance checks in a Function node, branches on threshold breaches, posts exception summaries to a dedicated Teams channel, writes an audit record to SharePoint, and triggers a human-approval step for sign-off before marking the run complete.",
    components: [
      {
        name: "n8n Scheduler",
        role: "Triggers the workflow at 23:00 nightly and on-demand via webhook",
        toolId: "n8n",
      },
      {
        name: "Snowflake Connector",
        role: "Pulls trial-balance and sub-ledger data for the close period",
        toolId: "snowflake-connector",
      },
      {
        name: "Variance Engine",
        role: "Function node: compares actuals vs. prior period and budget; flags breaches > £10k or 5%",
      },
      {
        name: "Teams Notifier",
        role: "Posts structured exception cards to #month-end-alerts channel",
        toolId: "microsoft-teams",
      },
      {
        name: "SharePoint Logger",
        role: "Appends audit record (timestamp, user, variance, resolution) to Reconciliation Log list",
        toolId: "sharepoint",
      },
      {
        name: "Approval Gate",
        role: "Waits for CFO/FC sign-off via Teams Adaptive Card before marking run complete",
      },
    ],
    integrationPoints: [
      "Snowflake — service-account credentials stored in n8n credential vault",
      "Microsoft 365 — OAuth app registration in Azure AD",
      "SharePoint REST API — list item creation",
      "Teams webhooks — incoming webhook per channel",
    ],
    dataFlows: [
      "Snowflake → n8n (batch extract) → variance check → branch",
      "Exception branch → Teams card → analyst response → SharePoint log",
      "Clean branch → SharePoint log → approval request → CFO sign-off → close flag",
    ],
    riskMitigations: [
      "Snowflake credentials rotated quarterly and stored encrypted in n8n vault",
      "All data stays within EU/UK — n8n instance deployed on Azure UK South",
      "Idempotent run IDs prevent duplicate reconciliation records",
      "Fallback: manual override webhook available to finance team",
    ],
  },
  discovery_questions: [
    "Which three systems are involved in the current 40-step reconciliation process, and who owns each?",
    "What is the current Snowflake access model — do consultants query directly or via an intermediary tool?",
    "Is Power Automate already licensed for all staff, or only specific roles?",
    "What does 'regulatory change notification' look like today — which feeds or bodies generate them?",
    "Who has authority to approve the engagement onboarding at each of the 6 steps?",
    "What is the data residency requirement for client data — EU only, or UK + EU?",
    "Has the firm evaluated n8n vs. Power Automate for workflow orchestration, and is there a preference?",
    "What would 'success' look like for the month-end close pilot — specific day target or cost saving?",
  ],
  top_workflow: {
    name: "Month-End Close Reconciliation",
    nodes: [
      {
        id: "1",
        name: "Schedule Trigger",
        type: "n8n-nodes-base.scheduleTrigger",
        typeVersion: 1.2,
        position: [240, 300],
        parameters: {
          rule: { interval: [{ field: "cronExpression", expression: "0 23 * * *" }] },
        },
      },
      {
        id: "2",
        name: "Snowflake — Pull Ledger",
        type: "n8n-nodes-base.snowflake",
        typeVersion: 1,
        position: [460, 300],
        parameters: {
          operation: "executeQuery",
          query: "SELECT * FROM finance.trial_balance WHERE period = :period",
        },
      },
      {
        id: "3",
        name: "Check Variances",
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [680, 300],
        parameters: {
          jsCode:
            "return items.map(i => ({ ...i, json: { ...i.json, breach: Math.abs(i.json.variance_pct) > 5 } }));",
        },
      },
      {
        id: "4",
        name: "IF Breach",
        type: "n8n-nodes-base.if",
        typeVersion: 2,
        position: [900, 300],
        parameters: {
          conditions: { boolean: [{ value1: "={{$json.breach}}", value2: true }] },
        },
      },
      {
        id: "5",
        name: "Teams — Alert",
        type: "n8n-nodes-base.microsoftTeams",
        typeVersion: 2,
        position: [1120, 200],
        parameters: {
          operation: "create",
          resource: "message",
          messageType: "text",
          message: "=Variance breach: {{$json.account}} {{$json.variance_pct}}%",
        },
      },
      {
        id: "6",
        name: "SharePoint — Log",
        type: "n8n-nodes-base.microsoftSharePoint",
        typeVersion: 1,
        position: [1340, 300],
        parameters: { operation: "create", resource: "listItem" },
      },
    ],
    connections: {
      "Schedule Trigger": {
        main: [[{ node: "Snowflake — Pull Ledger", type: "main", index: 0 }]],
      },
      "Snowflake — Pull Ledger": {
        main: [[{ node: "Check Variances", type: "main", index: 0 }]],
      },
      "Check Variances": { main: [[{ node: "IF Breach", type: "main", index: 0 }]] },
      "IF Breach": {
        main: [
          [{ node: "Teams — Alert", type: "main", index: 0 }],
          [{ node: "SharePoint — Log", type: "main", index: 0 }],
        ],
      },
      "Teams — Alert": {
        main: [[{ node: "SharePoint — Log", type: "main", index: 0 }]],
      },
    },
    settings: { executionOrder: "v1" },
  },
  playbook: `# NorthBound Solutions — Discovery Playbook

## Executive Summary

Three high-confidence automation opportunities identified. The month-end close workflow delivers the strongest ROI (£180k/yr, 8-day cycle reduction) and should be the pilot engagement. Two quick-wins (regulatory alerting, onboarding approval) can run in parallel at low effort.

## Recommended Engagement Sequence

### Phase 1 (Weeks 1–6): Month-End Close Pilot
- Kick-off with CFO, Head of Operations, IT admin
- Map current 40-step process → identify Snowflake tables + access model
- Build n8n workflow (scheduled extract → variance check → Teams alert → SharePoint log → approval)
- UAT with finance team across one close cycle
- Go-live; monitor for 2 cycles

### Phase 2 (Weeks 4–8, parallel): Quick-Wins
- Regulatory Change Alerting: identify feeds → build scrape → Teams pipeline → 2-week build
- Engagement Onboarding: map approval steps → Power Automate workflow → SharePoint tracker

## Key Risks

1. **Snowflake access**: confirm service-account permissions before build starts
2. **M365 tenant admin**: OAuth app registration requires Azure AD admin — book early
3. **ISO 27001 boundary**: all workflow infra must stay EU/UK — validate n8n hosting option

## NorthBound Tools Mapped

- **n8n** (Operations & Efficiency) — primary orchestrator for month-end and reg-alerting workflows
- **Microsoft Teams** — alert delivery and approval interface
- **SharePoint** — audit logging and tracker
- **Power Automate** — onboarding approval (already in M365 licence)
- **Snowflake Connector** — data source for reconciliation
`,
  readiness: {
    overallScore: 4,
    dimensions: {
      dataReadiness: {
        score: 4,
        notes: "Snowflake is the system of record; structured and queryable",
      },
      toolReadiness: {
        score: 5,
        notes: "M365 + Power Automate already licensed; n8n is low-lift addition",
      },
      changeReadiness: {
        score: 3,
        notes: "Finance team is motivated by pain point; IT admin bandwidth is the constraint",
      },
      budgetReadiness: {
        score: 4,
        notes: "£180k/yr ROI on month-end close justifies pilot investment easily",
      },
    },
    recommendation:
      "High readiness. Proceed to scoping call. Prioritise Snowflake access and Azure AD admin engagement in week 1.",
  },
  export_path: null,
  share_token_hash: null,
  share_expires_at: null,
  share_revoked_at: null,
  created_by: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
} as unknown as ReportRow;

export default function DemoReportPage() {
  return <ReportViewer report={DEMO_REPORT} runId={DEMO_RUN_ID} />;
}
