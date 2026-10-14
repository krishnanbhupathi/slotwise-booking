import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { twMerge } from "tailwind-merge";

/** Joins class names; later Tailwind classes win over conflicting earlier ones (w-32 beats w-full). */
const cx = (...classes: (string | false | null | undefined)[]) => twMerge(classes.filter(Boolean).join(" "));

const buttonStyles = {
  primary: "border-2 border-stone-900 bg-stone-900 text-white hover:bg-brand-800 disabled:border-stone-400 disabled:bg-stone-400",
  secondary: "border-2 border-stone-900 bg-white text-stone-900 hover:bg-stone-100 disabled:border-stone-300 disabled:text-stone-400",
  ghost: "text-stone-700 hover:bg-stone-100",
  danger: "text-red-700 hover:bg-red-50",
};

type Variant = keyof typeof buttonStyles;

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 font-display text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 disabled:cursor-not-allowed";

export function Button({ variant = "primary", className, ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={cx(buttonBase, buttonStyles[variant], className)} {...props} />;
}

export function ButtonLink({ variant = "primary", className, ...props }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={cx(buttonBase, buttonStyles[variant], className)} {...props} />;
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-bold text-stone-800">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-sm text-red-700">
          {error}
        </p>
      ) : hint ? (
        <p className="text-sm text-stone-500">{hint}</p>
      ) : null}
    </div>
  );
}

const inputStyles =
  "block w-full rounded-md border-[1.5px] border-stone-300 bg-white px-3 py-2 text-sm placeholder:text-stone-500 focus:border-stone-900 focus:outline-2 focus:outline-brand-100 aria-invalid:border-red-600";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(inputStyles, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cx(inputStyles, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx(inputStyles, className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cx("rounded-lg border-2 border-stone-900 bg-white", className)} {...props} />;
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-black tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-stone-600">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function FormMessage({ state }: { state?: { ok?: boolean; message?: string } | null }) {
  if (!state?.message) return null;
  return (
    <p role="status" className={cx("text-sm", state.ok ? "text-brand-700" : "text-red-700")}>
      {state.message}
    </p>
  );
}

export { cx };
