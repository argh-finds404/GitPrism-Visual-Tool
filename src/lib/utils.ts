import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge class names, with later Tailwind utilities beating earlier ones. What shadcn components import. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
