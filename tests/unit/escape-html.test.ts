import { describe, it, expect } from "vitest";
import { escapeHtml } from "@/lib/escape-html";

describe("escapeHtml", () => {
  it("escapes HTML-special characters", () => {
    expect(escapeHtml("<img src=x onerror=alert(1)>")).toBe("&lt;img src=x onerror=alert(1)&gt;");
    expect(escapeHtml("a & \"b\" 'c'")).toBe("a &amp; &quot;b&quot; &#39;c&#39;");
  });
  it("leaves plain Hebrew/number text unchanged", () => {
    expect(escapeHtml("בן יהודה 42")).toBe("בן יהודה 42");
  });
});
