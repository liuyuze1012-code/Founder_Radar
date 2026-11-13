import { createFileRoute } from "@tanstack/react-router";

// The home route ships no og:image, so serve-time hosting can inject the
// project's social preview (explicit og:image or latest screenshot).
export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-3 text-center"
      style={{ backgroundColor: "#fcfbf8" }}
    >
      <h1 className="text-4xl font-bold text-slate-900">Founder Radar</h1>
      <p className="text-slate-600">Sync test: this text was pushed from Claude Code via GitHub.</p>
    </div>
  );
}
