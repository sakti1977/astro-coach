import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabase-admin";

let _configured = false;

function ensureConfigured() {
  if (_configured) return;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    throw new Error("Push notifications are not configured (missing VAPID env vars)");
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  _configured = true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

export interface PushSubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth_key: string;
}

/**
 * Send a push notification to one subscription row. If the push service
 * reports the subscription is gone (404/410 — user revoked permission,
 * uninstalled, etc.), the row is deleted so future cron runs stop retrying it.
 */
export async function sendPush(sub: PushSubscriptionRow, payload: PushPayload): Promise<boolean> {
  ensureConfigured();
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth_key },
      },
      JSON.stringify(payload)
    );
    return true;
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number })?.statusCode;
    if (statusCode === 404 || statusCode === 410) {
      await supabaseAdmin?.from("push_subscriptions").delete().eq("id", sub.id);
    } else {
      console.error("Push send error:", err);
    }
    return false;
  }
}

export function isPushConfigured(): boolean {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
}
