import { describe, it, expect } from "vitest";
import { extractMainContent } from "./extract.js";

describe("extractMainContent (defuddle adapter)", () => {
  it("extracts main article content and drops nav/script boilerplate", async () => {
    const html = `<!doctype html><html><head><title>Acme</title>
      <script>var tracking = 1;</script><style>.x{color:red}</style></head>
      <body>
        <nav><a href="/">Home</a><a href="/about">About</a></nav>
        <main><article>
          <h1>Acme Corp builds widgets</h1>
          <p>Acme Corp is a mid-market manufacturer of precision widgets serving the aerospace sector.</p>
          <p>We operate three plants and ship globally with a focus on quality and compliance.</p>
        </article></main>
        <footer>© 2026 Acme. All rights reserved. Privacy Policy.</footer>
      </body></html>`;

    const md = await extractMainContent(html, "https://acme.example.com/");
    expect(md).toContain("precision widgets");
    expect(md).toContain("aerospace");
    expect(md).not.toContain("var tracking");
    expect(md).not.toContain("color:red");
  });

  it("falls back to a non-empty string on unparseable input", async () => {
    const md = await extractMainContent("not really <html", "https://x.example.com/");
    expect(typeof md).toBe("string");
  });
});
