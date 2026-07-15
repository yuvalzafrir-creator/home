// Escape user/scraped text before interpolating it into a raw HTML string
// (e.g. Leaflet's bindPopup, which parses its argument as HTML).
export function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}
