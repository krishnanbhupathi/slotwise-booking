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
        <p className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">
          You&apos;re in the shared demo account. Changes are visible to other visitors.
        </p>
      )}
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
          <Link href="/dashboard" className="font-semibold tracking-tight">
            Slotwise
          </Link>
          <DashboardNav />
          <div className="ml-auto flex items-center gap-2">
            <Link
              href={`/book/${provider.handle}`}
              target="_blank"
              className="text-sm font-medium text-brand-700 hover:underline"
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
