import sanitizeHtml from 'sanitize-html';
import { renderMarkdown } from './markdown';

// Article bodies (المقروءات) are authored in a rich WYSIWYG editor that stores
// HTML. Older entries may be plain text / Markdown. `renderArticle` returns
// safe HTML either way: HTML is sanitised against an allow‑list; anything that
// isn't HTML falls back to the Markdown renderer.

const HTML_RE = /<\/?(p|div|span|h[1-6]|ul|ol|li|blockquote|b|i|u|s|strong|em|br|a|font)\b/i;

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'div', 'span', 'b', 'strong', 'i', 'em', 'u', 's', 'strike',
    'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote', 'a', 'hr', 'font',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    font: ['face', 'size', 'color'],
    '*': ['style', 'dir'],
  },
  allowedStyles: {
    '*': {
      'font-family': [/^[\w\s,'"\-]+$/],
      'font-size': [/^\d+(\.\d+)?(px|pt|em|rem|%)$/, /^(xx-small|x-small|small|medium|large|x-large|xx-large)$/],
      color: [/^#[0-9a-fA-F]{3,8}$/, /^rgb\(/, /^[a-zA-Z]+$/],
      'background-color': [/^#[0-9a-fA-F]{3,8}$/, /^rgb\(/, /^[a-zA-Z]+$/],
      'text-align': [/^(right|left|center|justify)$/],
      'font-weight': [/^(bold|normal|\d{3})$/],
      'font-style': [/^(italic|normal)$/],
      'text-decoration': [/^(underline|line-through|none)( (underline|line-through))?$/],
    },
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer nofollow', target: '_blank' }),
  },
};

export function renderArticle(src?: string | null): string {
  const s = (src || '').trim();
  if (!s) return '';
  if (!HTML_RE.test(s)) return renderMarkdown(s);
  return sanitizeHtml(s, OPTIONS);
}
