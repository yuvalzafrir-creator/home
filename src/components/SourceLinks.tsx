const SOURCES = [
  { label: "יד2 — דירות למכירה", href: "https://www.yad2.co.il/realestate/forsale" },
  { label: "מדלן", href: "https://www.madlan.co.il" },
];

export function SourceLinks() {
  return (
    <div className="source-links">
      <span className="source-links__label">מקורות לחיפוש עצמאי</span>
      {SOURCES.map((s) => (
        <a key={s.href} href={s.href} target="_blank" rel="noopener noreferrer">
          {s.label} ↗
        </a>
      ))}
    </div>
  );
}
