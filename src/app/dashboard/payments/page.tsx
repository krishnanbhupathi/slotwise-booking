import type { Metadata } from "next";
import Link from "next/link";
import { Card, PageHeader, cx } from "@/components/ui";
import { db } from "@/db";
import { formatDateTimeIn } from "@/lib/format";
import { formatMoney } from "@/lib/validation";
import { listPayments } from "@/server/dashboard";
import { requireProvider } from "@/server/session";

export const metadata: Metadata = { title: "Payments" };

const STATUS_STYLES = {
  paid: "bg-[#ddf5ec] text-[#0b5a43]",
  refunded: "bg-stone-100 text-stone-700",
  pending: "bg-amber-50 text-amber-900",
  failed: "bg-stone-100 text-stone-500",
} as const;

const STATUS_LABELS = { paid: "Paid", refunded: "Refunded", pending: "Pending", failed: "Abandoned" } as const;

export default async function PaymentsPage() {
  const provider = await requireProvider();
  const rows = await listPayments(db, provider.id);
  const tz = provider.timezone;

  return (
    <>
      <PageHeader title="Payments" description="Deposits taken through Stripe (test mode). Newest first." />
      {rows.length === 0 ? (
        <Card className="p-6 text-sm text-stone-600">No payments yet.</Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-stone-200 text-stone-500">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">Date</th>
                <th scope="col" className="px-5 py-3 font-medium">Client</th>
                <th scope="col" className="px-5 py-3 font-medium">Session</th>
                <th scope="col" className="px-5 py-3 text-right font-medium">Amount</th>
                <th scope="col" className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className="px-5 py-3 whitespace-nowrap text-stone-600">{formatDateTimeIn(p.createdAt, tz)}</td>
                  <td className="px-5 py-3">{p.clientName}</td>
                  <td className="px-5 py-3">
                    <Link href={`/booking/${p.bookingId}`} className="hover:underline">
                      {p.serviceName}, {formatDateTimeIn(p.startsAt, tz)}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">{formatMoney(p.amountCents, p.currency)}</td>
                  <td className="px-5 py-3">
                    <span className={cx("rounded px-2 py-0.5 text-xs font-medium", STATUS_STYLES[p.status])}>
                      {STATUS_LABELS[p.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
