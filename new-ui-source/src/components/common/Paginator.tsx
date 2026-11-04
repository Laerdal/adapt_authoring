// LIFE table footer: row range, rows-per-page select, and numbered paginator.
// Styling lives in life-components.css (.life-table-footer, .life-paginator, .life-page-btn).

interface PaginatorProps {
  page: number;
  pageSize: number;
  totalItems: number;
  pageSizeOptions: number[];
  /** Singular noun for the range label, e.g. "template" → "1–10 of 25 templates". */
  itemLabel: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

type PageToken = number | "ellipsis-start" | "ellipsis-end";

function getPageTokens(page: number, totalPages: number): PageToken[] {
  const tokens: PageToken[] = [];
  const numbers = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1,
  );
  numbers.forEach((n, idx) => {
    if (idx > 0 && n - numbers[idx - 1] > 1) tokens.push(idx === 1 ? "ellipsis-start" : "ellipsis-end");
    tokens.push(n);
  });
  return tokens;
}

const ICON_PROPS = {
  width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true,
} as const;

export default function Paginator({
  page, pageSize, totalItems, pageSizeOptions, itemLabel, onPageChange, onPageSizeChange,
}: PaginatorProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);
  const first = safePage === 1;
  const last = safePage === totalPages;

  return (
    <div className="life-table-footer">
      <div className="flex flex-wrap items-center gap-2">
        <span>
          {totalItems === 0
            ? "0 results"
            : `${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, totalItems)} of ${totalItems} ${itemLabel}${totalItems !== 1 ? "s" : ""}`}
        </span>
        <span aria-hidden="true" className="text-[var(--life-neutral-300)]">|</span>
        <label htmlFor="life-rows-per-page">Rows per page:</label>
        <select
          id="life-rows-per-page"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="life-select"
        >
          {pageSizeOptions.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      <nav className="life-paginator" aria-label="Pagination">
        <button type="button" className="life-page-btn" onClick={() => onPageChange(1)} disabled={first} title="First page" aria-label="First page">
          <svg {...ICON_PROPS}><polyline points="11 17 6 12 11 7" /><polyline points="18 17 13 12 18 7" /></svg>
        </button>
        <button type="button" className="life-page-btn" onClick={() => onPageChange(Math.max(1, safePage - 1))} disabled={first} title="Previous page" aria-label="Previous page">
          <svg {...ICON_PROPS}><polyline points="15 18 9 12 15 6" /></svg>
        </button>

        {getPageTokens(safePage, totalPages).map((token) =>
          typeof token === "string" ? (
            <span key={token} aria-hidden="true" className="px-1 text-[var(--life-neutral-500)]">…</span>
          ) : (
            <button
              key={token}
              type="button"
              className="life-page-btn"
              aria-current={safePage === token ? "page" : undefined}
              aria-label={`Page ${token}`}
              onClick={() => onPageChange(token)}
            >
              {token}
            </button>
          ),
        )}

        <button type="button" className="life-page-btn" onClick={() => onPageChange(Math.min(totalPages, safePage + 1))} disabled={last} title="Next page" aria-label="Next page">
          <svg {...ICON_PROPS}><polyline points="9 18 15 12 9 6" /></svg>
        </button>
        <button type="button" className="life-page-btn" onClick={() => onPageChange(totalPages)} disabled={last} title="Last page" aria-label="Last page">
          <svg {...ICON_PROPS}><polyline points="13 17 18 12 13 7" /><polyline points="6 17 11 12 6 7" /></svg>
        </button>
      </nav>
    </div>
  );
}
