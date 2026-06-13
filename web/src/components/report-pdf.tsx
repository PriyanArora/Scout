// Server-rendered PDF deliverable (INTEGRATION_PLAN §3 Wave 5 #20). Uses
// @react-pdf/renderer in the Node/Vercel layer — no headless browser, $0 on Hobby.
// Rendered to a buffer by the /api/report/[runId]/pdf route.

import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

export interface ReportPdfData {
  name: string;
  summary: string;
  opportunities: Array<{
    title?: string;
    pillar?: string;
    priority?: number;
    impactScore?: number;
    effortScore?: number;
    roiEstimate?: string;
  }>;
  playbook: string;
}

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: "Helvetica", lineHeight: 1.4 },
  h1: { fontSize: 20, marginBottom: 6, fontFamily: "Helvetica-Bold" },
  h2: { fontSize: 14, marginTop: 16, marginBottom: 6, fontFamily: "Helvetica-Bold" },
  muted: { color: "#555", marginBottom: 12 },
  opp: { marginBottom: 8 },
  oppTitle: { fontFamily: "Helvetica-Bold" },
  playbook: { marginTop: 6 },
});

export function ReportPdf({ data }: { data: ReportPdfData }) {
  return (
    <Document title={`Scout Discovery — ${data.name}`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>{data.name || "Discovery Report"}</Text>
        <Text style={styles.muted}>NorthBound Advisory · Scout discovery report</Text>

        <Text style={styles.h2}>Summary</Text>
        <Text>{data.summary || "No summary available."}</Text>

        <Text style={styles.h2}>Opportunities ({data.opportunities.length})</Text>
        {data.opportunities.map((o, i) => (
          <View key={i} style={styles.opp}>
            <Text style={styles.oppTitle}>
              #{o.priority ?? i + 1} — {o.title ?? "Untitled"} {o.pillar ? `(${o.pillar})` : ""}
            </Text>
            <Text>
              Impact {o.impactScore ?? "—"}/5 · Effort {o.effortScore ?? "—"}/5
              {o.roiEstimate ? ` · ROI: ${o.roiEstimate}` : ""}
            </Text>
          </View>
        ))}

        <Text style={styles.h2}>Implementation Playbook</Text>
        <Text style={styles.playbook}>{data.playbook || "No playbook generated."}</Text>
      </Page>
    </Document>
  );
}
