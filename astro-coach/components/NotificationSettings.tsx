"use client";

import { useEffect, useState } from "react";

type SupportState = "checking" | "unsupported" | "supported";
type Prefs = { notify_dasha: boolean; notify_sade_sati: boolean; notify_sadhana: boolean };

const DEFAULT_PREFS: Prefs = { notify_dasha: true, notify_sade_sati: true, notify_sadhana: true };

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export default function NotificationSettings() {
  const [support, setSupport] = useState<SupportState>("checking");
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function check() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setSupport("unsupported");
        return;
      }
      setSupport("supported");
      setPermission(Notification.permission);

      try {
        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();
        if (existing) {
          setSubscribed(true);
          setEndpoint(existing.endpoint);
          const res = await fetch(`/api/push/subscribe?endpoint=${encodeURIComponent(existing.endpoint)}`);
          if (res.ok) {
            const data = await res.json();
            if (data.subscribed) {
              setPrefs({
                notify_dasha: data.notify_dasha,
                notify_sade_sati: data.notify_sade_sati,
                notify_sadhana: data.notify_sadhana,
              });
            }
          }
        }
      } catch {
        // Non-fatal — user can still try to enable
      }
    }
    check();
  }, []);

  async function enable() {
    setBusy(true);
    setError("");
    try {
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);
      if (permissionResult !== "granted") {
        throw new Error("Notification permission was not granted");
      }

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) throw new Error("Push notifications are not configured on this deployment");

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });

      const json = subscription.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not save subscription");
      }

      setSubscribed(true);
      setEndpoint(subscription.endpoint);
      setPrefs(DEFAULT_PREFS);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not enable notifications");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError("");
    try {
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (existing) {
        if (endpoint) {
          await fetch("/api/push/subscribe", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint }),
          }).catch(() => {});
        }
        await existing.unsubscribe();
      }
      setSubscribed(false);
      setEndpoint(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not disable notifications");
    } finally {
      setBusy(false);
    }
  }

  async function togglePref(key: keyof Prefs) {
    if (!endpoint) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    try {
      await fetch("/api/push/subscribe", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint, [key]: next[key] }),
      });
    } catch {
      setPrefs(prefs); // revert on failure
    }
  }

  if (support === "checking") return null;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6">
      <h2 className="font-semibold text-gray-900 mb-2">Notifications</h2>
      <p className="text-xs text-gray-500 mb-4">
        A gentle nudge when your dasha shifts, Sade Sati changes phase, or a day&apos;s sadhana is still undone —
        sent once, around your local morning.
      </p>

      {support === "unsupported" && (
        <p className="text-sm text-gray-500">Not supported on this browser/device.</p>
      )}

      {support === "supported" && permission === "denied" && (
        <p className="text-sm text-amber-600">
          Notifications are blocked for this site. Re-enable them in your browser&apos;s site settings to turn this on.
        </p>
      )}

      {support === "supported" && permission !== "denied" && !subscribed && (
        <button
          onClick={enable}
          disabled={busy}
          className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
        >
          {busy ? "Enabling…" : "Enable Notifications"}
        </button>
      )}

      {support === "supported" && subscribed && (
        <div className="space-y-3">
          {([
            ["notify_dasha", "Dasha & Antardasha transitions"],
            ["notify_sade_sati", "Sade Sati phase changes"],
            ["notify_sadhana", "Daily sadhana reminder"],
          ] as [keyof Prefs, string][]).map(([key, label]) => (
            <label key={key} className="flex items-center justify-between text-sm">
              <span className="text-gray-700">{label}</span>
              <input
                type="checkbox"
                checked={prefs[key]}
                onChange={() => togglePref(key)}
                className="w-4 h-4 accent-indigo-600"
              />
            </label>
          ))}
          <button
            onClick={disable}
            disabled={busy}
            className="text-xs text-red-600 hover:text-red-700 disabled:opacity-50 mt-2"
          >
            {busy ? "Disabling…" : "Disable notifications on this device"}
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
    </div>
  );
}
