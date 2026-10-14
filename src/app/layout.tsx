import type { Metadata } from "next";
import { Gabarito, Lexend } from "next/font/google";
import "./globals.css";

/** Headings, times and prices. */
const gabarito = Gabarito({ variable: "--font-gabarito", subsets: ["latin"], weight: ["500", "700", "900"] });
/** Body text: designed for easier reading, with plain (unslashed) zeros for prices. */
const lexend = Lexend({ variable: "--font-lexend", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Slotwise", template: "%s · Slotwise" },
  description: "Booking and deposits for solo tutors. Clients pick a slot, pay a deposit, and show up.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${gabarito.variable} ${lexend.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
