// A realistic saved profile for the browser: computes a real chart through
// the running app's guest /api/chart (so no hand-written chart JSON).
const BASE = process.env.BASE ?? "http://localhost:3123";
const res = await fetch(`${BASE}/api/chart`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: "Test", year: 1990, month: 5, day: 15, hour: 6, minute: 30, lat: 19.076, lng: 72.8777, tz_str: "Asia/Kolkata" }),
});
if (!res.ok) throw new Error(`chart failed ${res.status}: ${await res.text()}`);
const { chart, dashas } = await res.json();
const now = new Date().toISOString();
const plan = "**Your Rahu Mahadasha** is pulling your attention outward.\n\n**BEHAVIOR**\n- Write new ideas down and wait 48 hours before acting.\n\nThat's your plan.";
export const profile = {
  birthData: { name: "Test", date: "1990-05-15", time: "06:30", lat: 19.076, lng: 72.8777, timezone: "Asia/Kolkata", city: "Mumbai" },
  chart, dashas,
  validation: { questions: [], accuracyScore: 0, confirmedThemes: [], isValidated: false },
  goals: [{ id: "g1", category: "career", description: "Get promoted this year", createdAt: now }],
  habits: [{ id: "h1", habit: "Walk 20 minutes before email", frequency: "daily", planet: "saturn", category: "physical", why: "Saturn in H6", completedDates: [], streak: 0 }],
  chatHistory: [
    { role: "user", content: "I keep jumping between job ideas. Why?", timestamp: "2026-09-26T10:00:00.000Z" },
    { role: "assistant", content: plan, timestamp: "2026-09-26T10:00:05.000Z" },
  ],
  coaching: { behaviorProfile: [], lastUpdated: now, phase: "recommending", exchangeCount: 3, planDelivered: true, deliveredPlan: plan, tonePreference: "jyotish", includeReligiousSolutions: false, preferredLanguage: "en-IN" },
};
