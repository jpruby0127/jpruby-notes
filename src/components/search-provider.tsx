import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { SearchDialog } from "@/components/search-dialog";

interface SearchContextValue {
  openSearch: () => void;
}

const SearchContext = createContext<SearchContextValue | null>(null);

export function SearchProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <SearchContext.Provider value={{ openSearch: () => setOpen(true) }}>
      {children}
      <SearchDialog open={open} onOpenChange={setOpen} />
    </SearchContext.Provider>
  );
}

export function useSearch(): SearchContextValue {
  const value = useContext(SearchContext);
  if (!value) throw new Error("useSearch must be used inside SearchProvider");
  return value;
}
