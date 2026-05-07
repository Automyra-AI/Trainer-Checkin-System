import { clsx, type ClassValue } from "clsx";
import type { HTMLAttributes, ButtonHTMLAttributes, InputHTMLAttributes } from "react";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg bg-white/95 shadow-soft ring-1 ring-line/80 backdrop-blur transition-shadow",
        className
      )}
      {...props}
    />
  );
}

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  const variants = {
    primary: "bg-red-600 text-white shadow-sm hover:bg-red-700 active:bg-red-800",
    ghost: "bg-white text-ink shadow-sm ring-1 ring-line hover:bg-cloud active:bg-slate-100",
    danger: "bg-red-50 text-red-700 shadow-sm ring-1 ring-red-100 hover:bg-red-100 active:bg-red-200"
  };

  return (
    <button
      className={cn(
        "focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition duration-200 disabled:cursor-not-allowed disabled:opacity-50",
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
      className="focus-ring h-11 w-full rounded-md border border-line bg-white/95 px-3 text-sm shadow-sm transition placeholder:text-slate-400 hover:border-slate-300"
      {...props}
    />
  );
}
