// Detects anti-bot challenge/interstitial pages (e.g. Yad2's Radware) so callers
// can treat a fetched page as "blocked" rather than parsing junk.
export function looksLikeBotChallenge(html: string): boolean {
  return (
    html.includes("Radware Page") ||
    html.includes("verify-message") ||
    /Incident ID/i.test(html)
  );
}
