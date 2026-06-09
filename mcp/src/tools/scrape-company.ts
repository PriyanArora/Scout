interface ScrapeArgs {
  url: string;
}

export async function handleScrapeCompany(args: ScrapeArgs) {
  const { url } = args;

  try {
    const jinaRes = await fetch(`https://r.jina.ai/${url}`, {
      headers: { Accept: "text/markdown" },
    });

    if (!jinaRes.ok) {
      return {
        content: [{ type: "text" as const, text: `Scrape failed: ${jinaRes.status} ${jinaRes.statusText}` }],
        isError: true,
      };
    }

    const markdown = await jinaRes.text();
    const truncated = markdown.length > 20000 ? markdown.slice(0, 20000) + "\n\n[truncated]" : markdown;

    return {
      content: [{ type: "text" as const, text: truncated }],
    };
  } catch (err) {
    return {
      content: [{ type: "text" as const, text: `Scrape error: ${String(err)}` }],
      isError: true,
    };
  }
}
