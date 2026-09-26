"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { Heart, Copy, CheckCheck, Smartphone } from "lucide-react";
import AppShell from "@/components/AppShell";
import {
  SUPPORT_MAX_AMOUNT,
  SUPPORT_PRESET_AMOUNTS,
  buildUpiLink,
  normaliseAmount,
  readSupportConfig,
} from "@/lib/support";

export default function SupportPage() {
  const config = useMemo(() => readSupportConfig(), []);
  const [preset, setPreset] = useState<number | null>(SUPPORT_PRESET_AMOUNTS[1]);
  const [custom, setCustom] = useState("");
  const [qrSvg, setQrSvg] = useState("");
  const [copied, setCopied] = useState(false);

  const customAmount = normaliseAmount(custom);
  const customInvalid = custom.trim() !== "" && customAmount === null;
  const amount = custom.trim() ? customAmount : preset;
  const link = config ? buildUpiLink(config, amount) : "";

  useEffect(() => {
    if (!link) return;
    let cancelled = false;
    QRCode.toString(link, { type: "svg", margin: 1, width: 220, errorCorrectionLevel: "M" })
      .then((svg) => { if (!cancelled) setQrSvg(svg); })
      .catch(() => { if (!cancelled) setQrSvg(""); });
    return () => { cancelled = true; };
  }, [link]);

  async function copyId() {
    if (!config) return;
    try {
      await navigator.clipboard.writeText(config.upiId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — the ID is visible on screen to copy by hand.
    }
  }

  return (
    <AppShell>
      <div className="max-w-xl mx-auto px-4 py-10">
        <div className="text-center mb-8">
          <div className="w-11 h-11 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Heart className="w-5 h-5 text-rose-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Support Astro Coach</h1>
          <p className="text-sm text-gray-600 mt-2 leading-relaxed">
            Astro Coach has no paywall, no paid remedies and no gemstone upsells. If it has been useful to you, you can
            contribute whatever feels right. It keeps the ephemeris and the coach running.
          </p>
        </div>

        {!config ? (
          <p className="text-center text-sm text-gray-500 bg-white border border-gray-100 rounded-2xl p-6">
            Contributions aren&apos;t set up yet. Thank you for wanting to help.
          </p>
        ) : (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Choose an amount</p>
            <div className="flex flex-wrap gap-2">
              {SUPPORT_PRESET_AMOUNTS.map((a) => {
                const active = !custom.trim() && preset === a;
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => { setPreset(a); setCustom(""); }}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                      active ? "bg-indigo-600 text-white border-indigo-600" : "border-gray-200 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    ₹{a}
                  </button>
                );
              })}
              <label className="flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 focus-within:ring-2 focus-within:ring-indigo-500">
                ₹
                <input
                  inputMode="numeric"
                  value={custom}
                  onChange={(e) => setCustom(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
                  placeholder="Other"
                  aria-label="Other amount in rupees"
                  className="w-20 bg-transparent text-gray-900 focus:outline-none"
                />
              </label>
            </div>
            {customInvalid && (
              <p className="text-xs text-red-600 mt-2">Enter a whole amount between ₹1 and ₹{SUPPORT_MAX_AMOUNT.toLocaleString("en-IN")}.</p>
            )}

            <div className="mt-6 grid gap-6 sm:grid-cols-2 items-center">
              <div className="flex flex-col items-center">
                {qrSvg ? (
                  <div
                    className="w-[220px] h-[220px] rounded-xl border border-gray-100 p-1 bg-white"
                    aria-label="UPI QR code"
                    role="img"
                    // Generated locally by the qrcode library from a validated UPI link.
                    dangerouslySetInnerHTML={{ __html: qrSvg }}
                  />
                ) : (
                  <div className="w-[220px] h-[220px] rounded-xl bg-gray-50 animate-pulse" />
                )}
                <p className="text-xs text-gray-500 mt-2">Scan with any UPI app</p>
              </div>

              <div className="space-y-3">
                <a
                  href={link}
                  className="flex items-center justify-center gap-2 w-full bg-indigo-600 text-white rounded-xl px-4 py-3 text-sm font-semibold hover:bg-indigo-700"
                >
                  <Smartphone className="w-4 h-4" />
                  Pay{amount ? ` ₹${amount}` : ""} with a UPI app
                </a>
                <p className="text-xs text-gray-500 leading-relaxed">
                  On your phone this opens GPay, PhonePe, Paytm or BHIM. If your app declines the link, scan the QR code or
                  pay the UPI ID directly.
                </p>
                <div className="flex items-center justify-between gap-2 rounded-xl bg-gray-50 border border-gray-100 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-[11px] text-gray-500">UPI ID · {config.payeeName}</p>
                    <p className="text-sm font-mono text-gray-900 truncate">{config.upiId}</p>
                  </div>
                  <button type="button" onClick={copyId} className="shrink-0 inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800">
                    {copied ? <CheckCheck className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <ul className="mt-8 space-y-2 text-xs text-gray-500 leading-relaxed">
          <li>Contributions are entirely optional. Nothing in the app is locked, unlocked or changed by paying.</li>
          <li>Your chart gets exactly the same guidance and the same remedies either way. See <Link href="/trust" className="underline">how we work</Link>.</li>
          <li>Payments go directly to the UPI ID above; Astro Coach never sees your bank or card details.</li>
        </ul>
      </div>
    </AppShell>
  );
}
