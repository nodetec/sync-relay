import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}

export function formatTimestamp(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toLocaleString()
}

export function usagePercent(used: number, limit: number): number {
  if (limit === 0) return 0
  return Math.min(100, Math.round((used / limit) * 100))
}

export function usageColor(pct: number): string {
  if (pct >= 95) return "bg-destructive"
  if (pct >= 80) return "bg-yellow-500"
  return "bg-primary"
}
