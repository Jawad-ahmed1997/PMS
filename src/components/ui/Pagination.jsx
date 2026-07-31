import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Pagination({ currentPage, totalPages, onPageChange, className }) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <nav className={cn("flex items-center justify-between px-4 py-3 sm:px-6", className)} aria-label="Pagination">
      <div className="hidden sm:block">
        <p className="text-sm text-[color:var(--color-text-subtle)]">
          Showing page <span className="font-semibold text-[color:var(--color-text)]">{currentPage}</span> of{" "}
          <span className="font-semibold text-[color:var(--color-text)]">{totalPages}</span>
        </p>
      </div>
      <div className="flex flex-1 justify-between sm:justify-end gap-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="relative inline-flex items-center gap-1 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-card)] px-3 py-1.5 text-sm font-medium text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-muted-bg)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </button>
        <div className="hidden sm:flex items-center gap-1 mx-2">
          {pages.map((page) => (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={cn(
                "relative inline-flex items-center justify-center h-8 w-8 rounded-lg text-sm font-semibold transition-colors",
                currentPage === page
                  ? "bg-[color:var(--color-accent)] text-white"
                  : "text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-muted-bg)] hover:text-[color:var(--color-text)]"
              )}
            >
              {page}
            </button>
          ))}
        </div>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="relative inline-flex items-center gap-1 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-card)] px-3 py-1.5 text-sm font-medium text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-muted-bg)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}

export default Pagination;
