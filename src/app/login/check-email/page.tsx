import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui";

export const metadata: Metadata = { title: "Check your email" };

export default function CheckEmailPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-16">
      <Card className="p-6">
        <h1 className="font-display text-2xl font-black tracking-tight">Check your email</h1>
        <p className="mt-2 text-sm text-stone-600">
          We sent you a sign-in link. It works once and expires in 24 hours.
        </p>
        <Link href="/login" className="mt-6 inline-block font-display text-sm font-bold text-stone-900 hover:underline">
          Use a different email
        </Link>
      </Card>
    </main>
  );
}
