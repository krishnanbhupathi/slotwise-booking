"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-renders the page every 2 seconds (for up to a minute) while the payment webhook is on its way. */
export function RefreshWhilePending() {
  const router = useRouter();
  useEffect(() => {
    let count = 0;
    const timer = setInterval(() => {
      if (++count > 30) clearInterval(timer);
      router.refresh();
    }, 2000);
    return () => clearInterval(timer);
  }, [router]);
  return null;
}
