"use client";

import Link from "next/link";
import { Heart, X } from "lucide-react";
import { readSupportConfig } from "@/lib/support";

interface Props {
  /** One line tailored to where the nudge sits. */
  message: string;
  onDismiss?: () => void;
  className?: string;
}

/**
 * A small, dismissible invitation to contribute. Deliberately rendered as its
 * own card, never inside a coaching reply, and never mentioning remedies:
 * paying changes nothing about the guidance anyone receives.
 */
export default function SupportNudge({ message, onDismiss, className = "" }: Props) {
  if (!readSupportConfig()) return null;
  return (
    <div className={`flex items-center gap-3 rounded-2xl border border-rose-100 bg-rose-50/60 px-4 py-3 text-sm ${className}`.trim()}>
      <Heart className="w-4 h-4 shrink-0 text-rose-500" />
      <p className="flex-1 min-w-0 text-gray-700">
        {message}{" "}
        <Link href="/support" className="font-medium text-rose-700 hover:underline whitespace-nowrap">
          Support via UPI
        </Link>
      </p>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="shrink-0 text-gray-400 hover:text-gray-600" aria-label="Dismiss">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
