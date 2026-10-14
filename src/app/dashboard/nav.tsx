"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

const LINKS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/services", label: "Services" },
  { href: "/dashboard/availability", label: "Availability" },
  { href: "/dashboard/payments", label: "Payments" },
] as const;

export function DashboardNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Dashboard" className="flex gap-1 overflow-x-auto">
      {LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap",
              active ? "bg-stone-200/70 text-stone-900" : "text-stone-600 hover:bg-stone-100 hover:text-stone-900",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
