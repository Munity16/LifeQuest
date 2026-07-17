import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(value: string | null) {
  if (!value) return "Not completed";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function safeFilename(extension = "jpg") {
  return `${crypto.randomUUID()}.${extension.replace(/[^a-z0-9]/g, "") || "jpg"}`;
}
