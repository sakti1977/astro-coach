import Link from "next/link";
import { readSupportConfig } from "@/lib/support";

/** A quiet link to /support. Renders nothing until a UPI ID is configured. */
export default function SupportLink({ className = "", onNavigate }: { className?: string; onNavigate?: () => void }) {
  if (!readSupportConfig()) return null;
  return (
    <Link href="/support" onClick={onNavigate} className={className}>
      Support Astro Coach
    </Link>
  );
}
