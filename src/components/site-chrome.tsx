import { Link } from "@tanstack/react-router";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link to="/" className="flex items-baseline gap-3">
          <span className="font-display text-lg font-extrabold tracking-tight">INMOBI</span>
          <span className="h-4 w-px bg-border" />
          <span className="eyebrow text-muted-foreground">Sports Day 2026</span>
        </Link>
        <nav className="flex items-center gap-6">
          <Link
            to="/"
            hash="tournaments"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Tournaments
          </Link>
          <Link
            to="/"
            hash="schedule"
            className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:block"
          >
            Schedule
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p className="font-display text-sm font-bold tracking-tight">
          InMobi · Glance — Sports Day 2026
        </p>
        <p className="text-sm text-muted-foreground">
          It&rsquo;s all about celebrating one InMobi spirit.
        </p>
      </div>
    </footer>
  );
}
