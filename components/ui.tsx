import { clsx, type ClassValue } from "clsx";
import type { HTMLAttributes, ButtonHTMLAttributes, InputHTMLAttributes } from "react";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg bg-white shadow-soft ring-1 ring-line/80", className)} {...props} />;
}

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  const variants = {
    primary: "bg-brand text-white shadow-sm hover:bg-blue-600",
    ghost: "bg-white text-ink ring-1 ring-line hover:bg-cloud",
    danger: "bg-red-50 text-red-700 ring-1 ring-red-100 hover:bg-red-100"
  };

  return (
    <button
      className={cn(
        "focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className="focus-ring h-11 w-full rounded-md border border-line bg-white px-3 text-sm shadow-sm placeholder:text-slate-400"
      {...props}
    />
  );
}
