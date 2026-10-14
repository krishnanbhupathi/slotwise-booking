import { Button, ButtonLink } from "@/components/ui";
import { demoLogin } from "./login/actions";

/** An example week for the hero: what a student sees on a tutor's booking page. */
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const ROWS: { time: string; cells: (null | "closed" | { subject: number; label: string })[] }[] = [
  { time: "4:00", cells: [{ subject: 0, label: "Maths" }, null, "closed", { subject: 1, label: "Physics" }, null] },
  { time: "5:15", cells: [null, { subject: 1, label: "Physics" }, "closed", { subject: 0, label: "Maths" }, { subject: 2, label: "Intro" }] },
  { time: "6:30", cells: [{ subject: 2, label: "Intro" }, { subject: 0, label: "Maths" }, "closed", null, { subject: 0, label: "Maths" }] },
];

export default function Home() {
  return (
    <main className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-12 px-4 py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
      <div>
        <p className="flex items-center gap-2 font-display text-lg font-black tracking-tight">
          <span aria-hidden="true" className="grid grid-cols-2 gap-0.5">
            <span className="subject-0 lesson size-2.5 rounded-[3px]" />
            <span className="subject-1 lesson size-2.5 rounded-[3px]" />
            <span className="subject-2 lesson size-2.5 rounded-[3px]" />
            <span className="hatched size-2.5 rounded-[3px] border border-stone-300" />
          </span>
          Slotwise
        </p>
        <h1 className="mt-6 font-display text-5xl leading-[1.02] font-black tracking-tight text-balance sm:text-6xl">
          Your week, as a timetable students can book.
        </h1>
        <p className="mt-5 max-w-xl text-lg text-stone-700">
          Booking and deposits for solo tutors. Share one link: students pick a time in their own time zone, pay a
          deposit, and get a confirmation. No back-and-forth, fewer no-shows.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <form action={demoLogin}>
            <Button type="submit" className="px-5 py-3 text-base">
              Try the demo
            </Button>
          </form>
          <ButtonLink href="/login" variant="secondary" className="px-5 py-3 text-base">
            Sign in
          </ButtonLink>
        </div>
      </div>

      <figure className="min-w-0">
        <div aria-hidden="true" className="overflow-hidden rounded-lg border-2 border-stone-900 bg-white">
          <div className="grid grid-cols-[3rem_repeat(5,minmax(0,1fr))] text-center font-display text-sm font-bold">
            <span />
            {DAYS.map((d) => (
              <span key={d} className="border-l border-stone-200 py-2">
                {d}
              </span>
            ))}
            {ROWS.map((row) => (
              <div key={row.time} className="contents">
                <span className="border-t border-stone-200 py-3 text-xs text-stone-600">{row.time}</span>
                {row.cells.map((cell, i) => (
                  <span key={i} className={`border-t border-l border-stone-200 p-1 ${cell === "closed" ? "hatched" : ""}`}>
                    {cell && cell !== "closed" && (
                      <span className={`subject-${cell.subject} lesson block truncate rounded-md px-1.5 py-1.5 text-left text-xs`}>
                        {cell.label}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
        <figcaption className="mt-2 text-xs text-stone-600">Example week. Each subject has its own colour; hatched days are closed.</figcaption>
      </figure>
    </main>
  );
}
