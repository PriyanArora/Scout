import Link from "next/link";

export default function NotFound() {
  return (
    <main className="shell">
      <div className="card card--pad-lg rise" style={{ textAlign: "center" }}>
        <span className="eyebrow">404</span>
        <h1>This page is off the map</h1>
        <p className="lead" style={{ margin: "0 auto 1.25rem" }}>
          The report, run, or share link you followed doesn&apos;t exist or is no longer available.
        </p>
        <Link href="/dashboard" className="btn btn-primary">Back to discovery</Link>
      </div>
    </main>
  );
}
