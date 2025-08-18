import * as React from "react";

type InputMode = "content" | "sidebar";

interface InputManagerState {
  mode: InputMode;
  setMode: (mode: InputMode) => void;
  sidebarOpen: boolean;
  openSidebar: () => void;
  closeSidebar: () => void;
  canOpenSidebar: boolean;
  setCanOpenSidebar: (allowed: boolean) => void;
}

const InputManagerContext = React.createContext<InputManagerState | undefined>(undefined);

export function InputManagerProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = React.useState<InputMode>("content");
  const [sidebarOpen, setSidebarOpen] = React.useState<boolean>(false);
  const [canOpenSidebar, setCanOpenSidebar] = React.useState<boolean>(true);

  const openSidebar = React.useCallback(() => {
    setSidebarOpen(true);
    setMode("sidebar");
  }, []);

  const closeSidebar = React.useCallback(() => {
    setSidebarOpen(false);
    setMode("content");
  }, []);

  // Single global key handler with exclusive routing
  React.useEffect(() => {
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

    const handler = (e: KeyboardEvent) => {
      // Ignore form/video
      const t = e.target as HTMLElement | null;
      if (
        t instanceof HTMLInputElement ||
        t instanceof HTMLTextAreaElement ||
        t instanceof HTMLVideoElement
      )
        return;

      if (mode === "sidebar") {
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
          case "ArrowRight":
            e.preventDefault();
            closeSidebar();
            return;
          case "ArrowLeft":
            e.preventDefault();
            return;
        }
        return;
      }

      // content mode
      const row = getActiveRow();
      switch (e.key) {
        case "ArrowLeft": {
          if (row && row.scrollLeft > 0) {
            e.preventDefault();
            const step = 320;
            row.scrollTo({ left: row.scrollLeft - step, behavior: "smooth" });
            focusCol(row, Math.max(0, getColIndex(row) - 1));
          } else if (canOpenSidebar) {
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
          e.preventDefault();
          // 1) Prefer whatever card link is currently focused anywhere
          const focusedAnywhere = document.querySelector<HTMLAnchorElement>(
            "a[data-card-link='true']:focus",
          );
          if (focusedAnywhere) {
            focusedAnywhere.click();
            return;
          }
          // 2) Fallback to active row + computed column
          if (row) {
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

    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [mode, canOpenSidebar, openSidebar, closeSidebar]);

  const value: InputManagerState = React.useMemo(
    () => ({
      mode,
      setMode,
      sidebarOpen,
      openSidebar,
      closeSidebar,
      canOpenSidebar,
      setCanOpenSidebar,
    }),
    [mode, sidebarOpen, canOpenSidebar, openSidebar, closeSidebar],
  );

  return <InputManagerContext value={value}>{children}</InputManagerContext>;
}

export function useInputManager(): InputManagerState {
  const ctx = React.use(InputManagerContext);
  if (!ctx) throw new Error("useInputManager must be used within InputManagerProvider");
  return ctx;
}
