// HTML-to-text extraction and markdown normalization.
// Jina Reader (primary) already returns markdown, so this is used only
// by the direct-fetch fallback path.

const BLOCK_TAGS = new Set([
  "p", "h1", "h2", "h3", "h4", "h5", "h6",
  "li", "td", "th", "div", "section", "article",
  "header", "footer", "main", "aside", "blockquote",
  "tr", "br",
]);

export function extractTitle(html: string): string | undefined {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return m ? decodeHtmlEntities(m[1]!.trim()).slice(0, 200) : undefined;
}

export function htmlToText(html: string): string {
  // Remove head, scripts, styles, nav, footer boilerplate
  let text = html
    .replace(/<head[\s\S]*?<\/head>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  // Insert newlines for block-level elements
  text = text.replace(/<(\/?)([\w-]+)[^>]*>/gi, (_, slash, tag: string) => {
    return BLOCK_TAGS.has(tag.toLowerCase()) ? "\n" : " ";
  });

  text = decodeHtmlEntities(text);

  // Collapse whitespace
  return text
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function normalizeMarkdown(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+$/gm, "")   // trailing spaces
    .replace(/\n{3,}/g, "\n\n") // excess blank lines
    .trim();
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(parseInt(n, 10)));
}
