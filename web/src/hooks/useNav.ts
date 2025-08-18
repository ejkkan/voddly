import { useEffect } from "react";
import { useSidebar } from "~/lib/ui-state";

export function useNav() {
  const { sidebarOpen, openSidebar, closeSidebar } = useSidebar();

  useEffect(() => {
    const getActiveRow = (): HTMLDivElement | null => {
      const active = document.activeElement as HTMLElement | null;
      const focusedCard = active?.closest<HTMLElement>("[data-card-link='true']");
      if (focusedCard)
        return focusedCard.closest<HTMLDivElement>("[data-carousel='true']");
      const first = document.querySelector<HTMLDivElement>("[data-carousel='true']");
      return first || null;
    };

    const getRows = (): HTMLDivElement[] =>
      Array.from(document.querySelectorAll<HTMLDivElement>("[data-carousel='true']"));

    const getColIndex = (row: HTMLDivElement): number => {
      const links = Array.from(
        row.querySelectorAll<HTMLAnchorElement>("a[data-card-link='true']"),
      );
      const focused = row.querySelector<HTMLAnchorElement>(
        "a[data-card-link='true']:focus",
      );
      if (focused) {
        const i = links.findIndex((l) => l === focused);
        if (i >= 0) return i;
      }
      const step = 320;
      return Math.min(
        Math.max(0, Math.round(row.scrollLeft / step)),
        Math.max(0, links.length - 1),
      );
    };

    const focusCol = (row: HTMLDivElement, index: number) => {
      const links = Array.from(
        row.querySelectorAll<HTMLAnchorElement>("a[data-card-link='true']"),
      );
      if (links.length === 0) return;
      const step = 320;
      const clamped = Math.min(Math.max(0, index), links.length - 1);
      row.scrollTo({ left: clamped * step, behavior: "smooth" });
      links[clamped]?.focus();
    };

    const onKey = (e: KeyboardEvent) => {
      // Ignore form/video elements
      const t = e.target as HTMLElement | null;
      if (
        t instanceof HTMLInputElement ||
        t instanceof HTMLTextAreaElement ||
        t instanceof HTMLVideoElement
      )
        return;

      if (sidebarOpen) {
        const links = Array.from(
          document.querySelectorAll<HTMLAnchorElement>("[data-sidebar-link='true']"),
        );
        if (
          links.length > 0 &&
          document.activeElement?.closest("[data-sidebar-link='true']") == null
        ) {
          links[0].focus();
        }
        switch (e.key) {
          case "ArrowUp":
          case "ArrowDown": {
            e.preventDefault();
            const dir = e.key === "ArrowUp" ? -1 : 1;
            const idx = Math.max(
              0,
              Math.min(
                links.length - 1,
                links.findIndex((l) => l === document.activeElement) + dir,
              ),
            );
            links[idx]?.focus();
            return;
          }
          case "Enter":
            e.preventDefault();
            (document.activeElement as HTMLAnchorElement | null)?.click();
            return;
          case "Escape":
            e.preventDefault();
            closeSidebar();
            return;
          case "ArrowLeft":
          case "ArrowRight":
            e.preventDefault();
            return;
        }
        return;
      }

      const row = getActiveRow();
      switch (e.key) {
        case "ArrowLeft": {
          if (row && row.scrollLeft > 0) {
            e.preventDefault();
            const step = 320;
            row.scrollTo({ left: row.scrollLeft - step, behavior: "smooth" });
            focusCol(row, Math.max(0, getColIndex(row) - 1));
          } else {
            e.preventDefault();
            openSidebar();
          }
          return;
        }
        case "ArrowRight": {
          if (row) {
            const canRight = row.scrollLeft + row.clientWidth < row.scrollWidth - 1;
            if (canRight) {
              e.preventDefault();
              const step = 320;
              row.scrollTo({ left: row.scrollLeft + step, behavior: "smooth" });
              focusCol(row, getColIndex(row) + 1);
              return;
            }
          }
          return;
        }
        case "ArrowUp":
        case "ArrowDown": {
          const rows = getRows();
          if (rows.length === 0) return;
          const active = row ?? rows[0];
          const idx = rows.findIndex((r) => r === active);
          const dir = e.key === "ArrowUp" ? -1 : 1;
          const nextIdx = idx + dir;
          if (nextIdx >= 0 && nextIdx < rows.length) {
            e.preventDefault();
            const col = getColIndex(active);
            focusCol(rows[nextIdx], col);
          }
          return;
        }
        case "Enter": {
          if (row) {
            e.preventDefault();
            const focused = row.querySelector<HTMLAnchorElement>(
              "a[data-card-link='true']:focus",
            );
            if (focused) {
              focused.click();
              return;
            }
            const links = Array.from(
              row.querySelectorAll<HTMLAnchorElement>("a[data-card-link='true']"),
            );
            if (links.length > 0) {
              links[Math.max(0, getColIndex(row))]?.click();
            }
          }
          return;
        }
        case "Escape":
          return;
      }
    };

    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [sidebarOpen, openSidebar, closeSidebar]);
}
