/**
 * Parse les [[wiki-links]] dans un contenu markdown.
 * Retourne un tableau de { linkText, target }.
 *
 * Formats supportes :
 * - [[nom-du-document]]
 * - [[nom-du-document|texte affiche]]
 */
export interface ParsedLink {
  target: string;
  linkText: string;
}

const WIKI_LINK_REGEX = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

export function parseWikiLinks(content: string): ParsedLink[] {
  const links: ParsedLink[] = [];
  let match: RegExpExecArray | null;

  while ((match = WIKI_LINK_REGEX.exec(content)) !== null) {
    const target = match[1].trim();
    const linkText = match[2]?.trim() || target;
    links.push({ target, linkText });
  }

  return links;
}

export function replaceWikiLinks(
  content: string,
  resolver: (target: string) => string | null
): string {
  return content.replace(WIKI_LINK_REGEX, (fullMatch, target, displayText) => {
    const resolvedUrl = resolver(target.trim());
    if (!resolvedUrl) return fullMatch;
    const text = displayText?.trim() || target.trim();
    return `[${text}](${resolvedUrl})`;
  });
}
