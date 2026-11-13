import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button, Card, Input, Label } from "@heroui/react";
import { RefreshCw, Trash2 } from "lucide-react";
import { recheckTracked } from "@/lib/track.functions";
import { applyRecheck, untrack, useTracked } from "@/lib/tracking";
import { ActionChip, LaneBadge, PersonAvatar, ScoreMeters } from "@/components/radar/bits";

export const Route = createFileRoute("/tracked")({
  head: () => ({
    meta: [
      { title: "Tracked — Founder Radar" },
      {
        name: "description",
        content: "People you are tracking, and what changed since the last check.",
      },
      { property: "og:title", content: "Tracked — Founder Radar" },
      {
        property: "og:description",
        content: "People you are tracking, and what changed since the last check.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Tracked,
});

const MAX_PER_RESCAN = 15;
const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const time = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

function Tracked() {
  const people = Object.values(useTracked()).sort((a, b) => b.trackedAt.localeCompare(a.trackedAt));
  const [passcode, setPasscode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function rescan() {
    setMessage(null);
    setBusy(true);
    try {
      const res = await recheckTracked({
        data: { pickIds: people.slice(0, MAX_PER_RESCAN).map((p) => p.pickId), passcode },
      });
      if (!res.ok) return setMessage({ ok: false, text: res.error });
      const changed = applyRecheck(res.results, res.checkedAt);
      const n = res.results.length;
      setMessage({
        ok: true,
        text: `Checked ${n} ${n === 1 ? "person" : "people"}. ${
          changed
            ? `${changed} ${changed === 1 ? "has" : "have"} changes.`
            : "No changes since the last check."
        }`,
      });
    } catch {
      setMessage({ ok: false, text: "The rescan failed. Try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Watchlist</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">Tracked</h1>
          <p className="mt-2 text-muted">
            A single look can't tell who will start a company. A change can: a new I-Corps award, a
            company appearing on their papers. Rescan to see what's new for the people you track.
          </p>
        </div>
        {people.length > 0 && (
          <Card className="w-full max-w-sm gap-3 p-4">
            <div className="grid gap-1.5">
              <Label htmlFor="rescan-passcode">Passcode</Label>
              <Input
                variant="secondary"
                id="rescan-passcode"
                type="password"
                autoComplete="off"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
              />
            </div>
            <Button variant="primary" isDisabled={busy || !passcode} onPress={rescan}>
              <RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} />
              {busy
                ? "Checking public records…"
                : `Rescan ${Math.min(people.length, MAX_PER_RESCAN)} tracked`}
            </Button>
            {message && (
              <p className={`text-sm ${message.ok ? "text-foreground" : "text-danger"}`}>
                {message.text}
              </p>
            )}
          </Card>
        )}
      </div>

      {people.length === 0 ? (
        <Card className="items-center gap-2 p-12 text-center">
          <h2 className="text-lg font-semibold">You aren't tracking anyone yet</h2>
          <p className="max-w-md text-sm text-muted">
            Click Track on a card in the Digest. The list is saved in this browser, so it stays on
            this device.
          </p>
          <Link
            to="/"
            className="mt-3 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground"
          >
            Open the Digest
          </Link>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {people.map((p) => {
            const last = p.history[0];
            return (
              <Card key={p.pickId} className="gap-4 p-5">
                <div className="flex items-start gap-3">
                  <PersonAvatar name={p.name} lane={p.lane} />
                  <div className="min-w-0 flex-1">
                    <Link
                      to="/founder/$pickId"
                      params={{ pickId: p.pickId }}
                      className="font-semibold leading-tight hover:underline"
                    >
                      {p.name}
                    </Link>
                    <div className="truncate text-sm text-muted">{p.school}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <LaneBadge lane={p.lane} />
                    <ActionChip action={p.action} />
                  </div>
                </div>
                <ScoreMeters r={p.research} p={p.propensity} t={p.timing} lane={p.lane} />
                <div className="rounded-xl bg-default/60 px-4 py-3 text-sm">
                  {!last ? (
                    <p className="text-muted">
                      Not rescanned yet. The evidence was saved when you clicked Track.
                    </p>
                  ) : last.items.length === 0 ? (
                    <p className="text-muted">No changes at the last check.</p>
                  ) : (
                    <>
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-accent">
                        Changed on {day(last.at)}
                      </p>
                      <ul className="space-y-1">
                        {last.items.map((item) => (
                          <li key={item} className="flex gap-2">
                            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 text-xs text-muted">
                  <span>
                    Tracked since {day(p.trackedAt)} ·{" "}
                    {p.lastCheckedAt
                      ? `Last checked ${time(p.lastCheckedAt)}`
                      : "Not checked since"}
                  </span>
                  <Button size="sm" variant="ghost" onPress={() => untrack(p.pickId)}>
                    <Trash2 className="size-4" />
                    Remove
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
