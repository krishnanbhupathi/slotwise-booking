import Link from "next/link";
import { Button } from "@/components/ui";
import { requireProvider } from "@/server/session";
import { logout } from "./actions";
import { DashboardNav } from "./nav";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const provider = await requireProvider();
  const isDemo = provider.email === process.env.DEMO_EMAIL;

  return (
    <div className="flex flex-1 flex-col">
      {isDemo && (
        <p className="hatched border-b-2 border-stone-900 bg-amber-100 px-4 py-2 text-center text-sm font-bold text-amber-950">
          You&apos;re in the shared demo account. Changes are visible to other visitors.
        </p>
      )}
      <header className="border-b-2 border-stone-900 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
          <Link href="/dashboard" className="flex items-center gap-2 font-display text-lg font-black tracking-tight">
            <span aria-hidden="true" className="grid grid-cols-2 gap-0.5">
              <span className="subject-0 lesson size-2 rounded-[2px]" />
              <span className="subject-1 lesson size-2 rounded-[2px]" />
              <span className="subject-2 lesson size-2 rounded-[2px]" />
              <span className="hatched size-2 rounded-[2px] border border-stone-300" />
            </span>
            Slotwise
          </Link>
          <DashboardNav />
          <div className="ml-auto flex items-center gap-2">
            <Link
              href={`/book/${provider.handle}`}
              target="_blank"
              className="font-display text-sm font-bold text-stone-900 hover:underline"
            >
              View booking page ↗
            </Link>
            <form action={logout}>
              <Button type="submit" variant="ghost">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
