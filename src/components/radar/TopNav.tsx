import { Link } from "@tanstack/react-router";

export function TopNav() {
  const cls = "rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground";
  const active = { className: "rounded-md px-3 py-2 text-sm font-medium bg-secondary text-foreground" };
  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-baseline gap-2">
          <span className="font-display text-xl font-bold tracking-tight">Founder Radar</span>
          <span className="hidden text-xs text-muted-foreground sm:inline">Washington DC research</span>
        </Link>
        <nav className="flex gap-1">
          <Link to="/setup" className={cls} activeProps={active}>Setup</Link>
          <Link to="/" className={cls} activeProps={active} activeOptions={{ exact: true }}>Digest</Link>
          <Link to="/candidates" className={cls} activeProps={active}>All candidates</Link>
        </nav>
      </div>
    </header>
  );
}
