import { Link } from "@tanstack/react-router";
import { Radar } from "lucide-react";
import { useTracked } from "@/lib/tracking";

export function TopNav() {
  const tracked = Object.keys(useTracked()).length;
  const tab =
    "rounded-full px-3.5 py-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground";
  const active = {
    className:
      "rounded-full px-3.5 py-1.5 text-sm font-medium bg-surface text-foreground shadow-sm",
  };
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-xl bg-accent text-accent-foreground">
            <Radar className="size-[18px]" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">Founder Radar</span>
        </Link>
        <nav className="flex items-center gap-1 rounded-full bg-default p-1">
          <Link to="/" className={tab} activeProps={active} activeOptions={{ exact: true }}>
            Dashboard
          </Link>
          <Link to="/tracked" className={tab} activeProps={active}>
            Tracked
            {tracked > 0 && (
              <span className="ml-1.5 rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-semibold text-accent-foreground">
                {tracked}
              </span>
            )}
          </Link>
        </nav>
        <Link
          to="/setup"
          className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground shadow-sm transition-opacity hover:opacity-90"
        >
          New scan
        </Link>
      </div>
    </header>
  );
}
