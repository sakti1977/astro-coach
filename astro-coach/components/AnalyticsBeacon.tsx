"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics-client";

/** Records one anonymous "visit" per browser per day (the funnel's top and its return-visit signal). */
export default function AnalyticsBeacon() {
  useEffect(() => {
    trackEvent("visit");
  }, []);

  return null;
}
