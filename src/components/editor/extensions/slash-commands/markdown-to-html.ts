// ---------------------------------------------------------------------------
// Markdown -> HTML converter (simple, for template insertion)
// ---------------------------------------------------------------------------

export function markdownToHtml(md: string): string {
  let html = md;

  // Headers
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  // Horizontal rules
  html = html.replace(/^---$/gm, "<hr>");

  // Bold + italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Tables
  const lines = html.split("\n");
  const result: string[] = [];
  let inTable = false;
  let headerDone = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("|") && line.endsWith("|")) {
      // Check if this is a separator row (|---|---|)
      if (/^\|[\s\-:]+\|/.test(line) && line.replace(/[\s|:\-]/g, "") === "") {
        // Skip separator row
        continue;
      }
      if (!inTable) {
        result.push("<table>");
        inTable = true;
        headerDone = false;
      }
      const cells = line.slice(1, -1).split("|").map((c) => c.trim());
      const tag = !headerDone ? "th" : "td";
      result.push(
        "<tr>" + cells.map((c) => `<${tag}>${c}</${tag}>`).join("") + "</tr>"
      );
      if (!headerDone) headerDone = true;
    } else {
      if (inTable) {
        result.push("</table>");
        inTable = false;
      }
      result.push(line);
    }
  }
  if (inTable) result.push("</table>");
  html = result.join("\n");

  // Task lists (before regular lists)
  html = html.replace(/^- \[x\] (.+)$/gm, '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>$1</p></li></ul>');
  html = html.replace(/^- \[ \] (.+)$/gm, '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>$1</p></li></ul>');

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, "<li>$1</li>");
  // Merge consecutive <li> into <ul>
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, "<ul>$1</ul>");
  // Remove duplicate nested ul from taskList
  html = html.replace(/<ul>(<ul data-type="taskList">)/g, "$1");
  html = html.replace(/(<\/ul>)<\/ul>/g, "$1");

  // Blockquotes
  html = html.replace(/^> (.+)$/gm, "<blockquote><p>$1</p></blockquote>");

  // Paragraphs: wrap remaining loose text lines
  html = html.replace(/^(?!<[a-z/])((?!\s*$).+)$/gm, "<p>$1</p>");

  // Clean up empty lines
  html = html.replace(/\n{2,}/g, "\n");

  return html;
}
