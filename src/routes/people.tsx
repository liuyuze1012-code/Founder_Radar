import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getPeople } from "@/lib/data.functions";
import { SampleBanner } from "@/components/radar/bits";
import { PeopleTable } from "@/components/radar/PeopleTable";

const peopleQuery = queryOptions({ queryKey: ["people"], queryFn: () => getPeople() });

export const Route = createFileRoute("/people")({
  head: () => ({
    meta: [
      { title: "People — Founder Radar" },
      {
        name: "description",
        content: "Everyone sourced across all your scans, in one searchable list.",
      },
      { property: "og:title", content: "People — Founder Radar" },
      {
        property: "og:description",
        content: "Everyone sourced across all your scans, in one searchable list.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(peopleQuery),
  component: People,
});

function People() {
  const { data } = useSuspenseQuery(peopleQuery);
  return (
    <div>
      <SampleBanner show={data.isSample} />
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Database</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">People</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Everyone your scans have sourced, kept across every report. Each person shows their most
        recent scores. Open a row for the evidence.
      </p>
      <div className="mt-6">
        <PeopleTable rows={data.rows} showThesis />
      </div>
    </div>
  );
}
