// scrape_company — pure data fetch. Pulls a company page as Markdown via the
// keyless Jina Reader (no API key, $0). No LLM here: Claude (the host) reads this
// raw text and does all the profiling/opportunity reasoning itself.

interface ScrapeArgs {
  url: string;
}

const JINA_TIMEOUT_MS = 30_000;
const MAX_CHARS = 20_000;

// Heuristics that mean "we got a block page, not real content" — surfaced so
// Claude knows to treat the scrape as low-signal rather than as the real site.
const LOW_SIGNAL_PATTERNS = [
  /access denied/i, /enable javascript/i, /captcha/i, /cloudflare/i,
  /checking your browser/i, /robot.*check/i,
];

export async function handleScrapeCompany(args: ScrapeArgs) {
  const { url } = args;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), JINA_TIMEOUT_MS);

  try {
    const res = await fetch(`https://r.jina.ai/${encodeURIComponent(url)}`, {
      headers: { Accept: "text/markdown, text/plain, */*" },
      signal: controller.signal,
    });

    if (!res.ok) {
      return {
        content: [{ type: "text" as const, text: `Scrape failed: ${res.status} ${res.statusText}` }],
        isError: true,
      };
    }

    const markdown = await res.text();
    const lowSignal = markdown.length < 200 || LOW_SIGNAL_PATTERNS.some((re) => re.test(markdown));
    const title = /^#+ (.+)$/m.exec(markdown)?.[1]?.trim();
    const truncated = markdown.length > MAX_CHARS ? markdown.slice(0, MAX_CHARS) + "\n\n[truncated]" : markdown;

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ url, title, lowSignal, chars: markdown.length }, null, 2) +
            "\n\n---\n\n" + truncated,
        },
      ],
    };
  } catch (err) {
    const msg = controller.signal.aborted ? `Scrape timed out after ${JINA_TIMEOUT_MS}ms` : `Scrape error: ${String(err)}`;
    return {
      content: [{ type: "text" as const, text: msg }],
      isError: true,
    };
  } finally {
    clearTimeout(timer);
  }
}
