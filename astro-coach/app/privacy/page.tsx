import Link from "next/link";
import LegalPage from "@/components/legal/LegalPage";
import { LEGAL } from "@/lib/legal";

export const metadata = {
  title: "Privacy Policy — Jyotish Coach",
  description: "What Jyotish Coach collects, why, who processes it, and how to see, export or delete your data.",
};

const mail = `mailto:${LEGAL.contactEmail}`;

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={`This policy explains what ${LEGAL.productName} (${LEGAL.site}) collects when you use it, why, who processes it on our behalf, and what you can do about it. We have tried to write it plainly. If anything is unclear, write to us.`}
    >
      <h2>Who is responsible</h2>
      <p>
        {LEGAL.productName} is run by {LEGAL.operator}, who decides how your personal data is used (the
        &ldquo;Data Fiduciary&rdquo; under India&rsquo;s Digital Personal Data Protection Act, 2023). Contact:{" "}
        <a href={mail}>{LEGAL.contactEmail}</a>.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Account details:</strong> your email address or phone number, and a password if you sign up by email. Passwords are handled by our authentication provider; we never see them in plain text.</li>
        <li><strong>Birth details:</strong> name, date, time and place of birth, plus the coordinates and time zone we look up for that place. These are needed to calculate your chart.</li>
        <li><strong>Your chart:</strong> the planetary positions, divisional charts and dasha periods calculated from your birth details.</li>
        <li><strong>Coaching conversations:</strong> the messages you send and the coach&rsquo;s replies.</li>
        <li><strong>Coach memory:</strong> short notes the coach keeps about your goals and patterns so later conversations make sense. You can see and delete these in the Memory panel.</li>
        <li><strong>Goals, habits and check-ins:</strong> what you track, when you mark it done, and your answers to chart validation questions.</li>
        <li><strong>Feedback:</strong> if you rate a reply with thumbs up or down, we store the rating with that reply.</li>
        <li><strong>Notifications:</strong> if you turn on reminders, your browser&rsquo;s push subscription (an address your browser gives us to deliver notifications).</li>
        <li><strong>Technical data:</strong> your IP address, used briefly to limit abuse (rate limiting), and standard server logs kept by our host for a short period.</li>
      </ul>
      <p>
        Birth details and conversations can reveal sensitive things about your life. Only share what you are comfortable
        sharing; the coach works without names of other people, health details or financial specifics.
      </p>

      <h2>What we do not collect</h2>
      <ul>
        <li>We do not run advertising or third-party analytics trackers, and we do not sell or rent your data.</li>
        <li>Voluntary contributions by UPI go straight from your UPI app to our UPI ID. We never see your bank account, card or UPI PIN.</li>
      </ul>

      <h2>Why we use it</h2>
      <ul>
        <li>To calculate your chart and give you coaching grounded in it (performing the service you asked for).</li>
        <li>To keep your account, chart and history available across devices when you are signed in.</li>
        <li>To send reminders you have switched on.</li>
        <li>To keep the service safe: rate limiting, abuse prevention and fixing errors.</li>
        <li>To improve replies, using the ratings you choose to give.</li>
      </ul>
      <p>We rely on your consent, given when you create an account and when you enable optional features. You can withdraw it at any time (see &ldquo;Your choices&rdquo; below).</p>

      <h2>Who processes your data for us</h2>
      <ul>
        <li><strong>Supabase</strong> (database and sign-in), hosted in Tokyo, Japan.</li>
        <li><strong>Railway</strong> (application hosting), servers in the United States.</li>
        <li><strong>Anthropic</strong> (the AI model that writes coaching replies), United States. Your chart summary and conversation are sent to generate each reply. Under Anthropic&rsquo;s commercial terms, API data is not used to train their models by default and is retained only for a limited period.</li>
        <li><strong>Sarvam AI</strong> (India), only if you choose a language other than English or use voice: the text or audio is sent for translation, speech-to-text or text-to-speech.</li>
        <li><strong>OpenStreetMap Nominatim</strong>: the place name you type when searching for your birthplace.</li>
        <li><strong>Your browser&rsquo;s push service</strong> (for example Google or Apple), only if you turn on notifications.</li>
      </ul>
      <p>
        Some of these providers are outside India, so your data is transferred abroad. We only use providers that
        protect it under contract, and we will follow any restrictions the Government of India places on such transfers.
      </p>

      <h2>On your device</h2>
      <p>
        We use one essential cookie to keep you signed in. Your chart, settings and recent history are also saved in your
        browser&rsquo;s local storage so the app works quickly and offline. There are no advertising cookies.
      </p>

      <h2>How long we keep it</h2>
      <p>
        We keep your account data while your account is open. When you ask us to delete your account, we delete your
        profile, chart, conversations, memory, habits and ratings from our database within 30 days, except where the law
        requires us to keep something longer. Backups held by our providers expire on their own schedule.
      </p>

      <h2>Your choices and rights</h2>
      <ul>
        <li><strong>See and export:</strong> Profile → &ldquo;Export all my data (JSON)&rdquo; downloads your profile, chart, conversations, goals, habits and coach memory. For anything else we hold (such as ratings), email us.</li>
        <li><strong>Correct:</strong> edit your birth details, goals and habits in the app at any time.</li>
        <li><strong>Delete memory:</strong> remove individual coach notes in the Memory panel.</li>
        <li><strong>Clear this device:</strong> Profile → &ldquo;Clear local data only&rdquo;.</li>
        <li><strong>Delete your account:</strong> email <a href={mail}>{LEGAL.contactEmail}</a> from the address or phone number on the account.</li>
        <li><strong>Stop notifications:</strong> switch them off in the app or in your browser settings.</li>
        <li><strong>Nominate someone</strong> to exercise these rights if you die or become unable to, and <strong>raise a grievance</strong> (below).</li>
      </ul>
      <p>We answer requests within 30 days.</p>

      <h2>Age</h2>
      <p>{LEGAL.productName} is for people aged {LEGAL.minimumAge} and over. We do not knowingly collect data from children. If you believe a child has used it, write to us and we will delete the account.</p>

      <h2>Security</h2>
      <p>
        Data travels over HTTPS, and database access is restricted so that each account can reach only its own rows. No
        system is perfectly secure; if a breach affects you, we will tell you and the Data Protection Board of India as the
        law requires.
      </p>

      <h2>Grievances</h2>
      <p>
        {LEGAL.grievanceOfficer}: <a href={mail}>{LEGAL.contactEmail}</a>. We acknowledge complaints within 72 hours and
        aim to resolve them within 30 days. If you are not satisfied, you may complain to the Data Protection Board of India.
      </p>

      <h2>Changes</h2>
      <p>
        If we change this policy in a way that matters, we will say so in the app before the change takes effect. The date
        at the top shows when it last changed. See also our <Link href="/terms">Terms of Use</Link>.
      </p>
    </LegalPage>
  );
}
