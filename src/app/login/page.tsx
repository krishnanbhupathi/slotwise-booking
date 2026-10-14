import type { Metadata } from "next";
import Link from "next/link";
import { Button, Card } from "@/components/ui";
import { demoLogin } from "./actions";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

// Auth.js redirects here with ?error=<code>. Anything unexpected gets the generic message.
const ERROR_MESSAGES: Record<string, string> = {
  Verification: "That sign-in link is invalid or has already been used. Request a new one.",
  Configuration: "Sign-in is unavailable right now. Try the demo account, or try again later.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-16">
      <Link href="/" className="mb-8 font-display text-xl font-black tracking-tight">
        Slotwise
      </Link>
      <Card className="p-6">
        <h1 className="font-display text-2xl font-black tracking-tight">Sign in or create an account</h1>
        <p className="mt-1 mb-6 text-sm text-stone-600">No password. We&apos;ll email you a link.</p>
        {error && (
          <p role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
            {ERROR_MESSAGES[String(error)] ?? "Something went wrong signing you in. Try again."}
          </p>
        )}
        <LoginForm />
        <div className="my-6 flex items-center gap-3 text-xs text-stone-500">
          <span className="h-px flex-1 bg-stone-200" />
          or
          <span className="h-px flex-1 bg-stone-200" />
        </div>
        <form action={demoLogin}>
          <Button type="submit" variant="secondary" className="w-full">
            Try the demo account
          </Button>
        </form>
      </Card>
    </main>
  );
}
