/**
 * Minimal, dependency‑free Markdown → HTML renderer for article bodies
 * (المقروءات). Supports a deliberately small, safe subset: headings,
 * bold/italic, unordered/ordered lists, blockquotes, horizontal rules and
 * paragraphs. All input is HTML‑escaped first, so the output is safe to inject
 * with `dangerouslySetInnerHTML`.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Inline formatting applied to already‑escaped text. */
function inline(s: string): string {
  return s
    // bold **text**
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // italic *text*
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
}

export function renderMarkdown(src: string): string {
  const text = escapeHtml((src || '').replace(/\r\n/g, '\n').trim());
  if (!text) return '';

  const blocks = text.split(/\n{2,}/);
  const html: string[] = [];

  for (const raw of blocks) {
    const block = raw.replace(/\n+$/, '');
    const lines = block.split('\n');

    // Horizontal rule
    if (/^\s*(---|\*\*\*|___)\s*$/.test(block)) {
      html.push('<hr />');
      continue;
    }

    // Heading (#, ##, ###)
    const h = block.match(/^(#{1,3})\s+(.*)$/);
    if (h && lines.length === 1) {
      const level = h[1].length;
      html.push(`<h${level}>${inline(h[2].trim())}</h${level}>`);
      continue;
    }

    // Blockquote
    if (lines.every((l) => /^\s*>\s?/.test(l))) {
      const inner = lines.map((l) => inline(l.replace(/^\s*>\s?/, ''))).join('<br />');
      html.push(`<blockquote>${inner}</blockquote>`);
      continue;
    }

    // Ordered list
    if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) {
      const items = lines.map((l) => `<li>${inline(l.replace(/^\s*\d+[.)]\s+/, ''))}</li>`).join('');
      html.push(`<ol>${items}</ol>`);
      continue;
    }

    // Unordered list
    if (lines.every((l) => /^\s*[-*•]\s+/.test(l))) {
      const items = lines.map((l) => `<li>${inline(l.replace(/^\s*[-*•]\s+/, ''))}</li>`).join('');
      html.push(`<ul>${items}</ul>`);
      continue;
    }

    // Paragraph (single newlines → <br>)
    html.push(`<p>${lines.map((l) => inline(l)).join('<br />')}</p>`);
  }

  return html.join('\n');
}
