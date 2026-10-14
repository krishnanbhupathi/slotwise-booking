import { Button, ButtonLink } from "@/components/ui";
import { demoLogin } from "./login/actions";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-24">
      <p className="text-sm font-semibold tracking-wide text-brand-700 uppercase">Slotwise</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
        Booking and deposits for solo tutors.
      </h1>
      <p className="mt-4 max-w-xl text-lg text-stone-600">
        Share one link. Students pick a time in their own time zone, pay a deposit, and get a confirmation. No
        back-and-forth, fewer no-shows.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <form action={demoLogin}>
          <Button type="submit" className="px-4 py-2.5">
            Try the demo
          </Button>
        </form>
        <ButtonLink href="/login" variant="secondary" className="px-4 py-2.5">
          Sign in
        </ButtonLink>
      </div>
    </main>
  );
}
