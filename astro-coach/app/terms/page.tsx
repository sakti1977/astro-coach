import Link from "next/link";
import LegalPage from "@/components/legal/LegalPage";
import { LEGAL } from "@/lib/legal";

export const metadata = {
  title: "Terms of Use — Jyotish Coach",
  description: "The terms for using Jyotish Coach: what the service is and is not, your responsibilities, and ours.",
};

const mail = `mailto:${LEGAL.contactEmail}`;

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Use"
      intro={`These terms apply when you use ${LEGAL.productName} (${LEGAL.site}), run by ${LEGAL.operator}. By creating an account or using the service you agree to them. If you do not agree, please do not use it.`}
    >
      <h2>What the service is</h2>
      <p>
        {LEGAL.productName} calculates a Vedic (Jyotish) birth chart and offers AI-generated coaching that uses the chart as
        a lens for reflection, habits and remedial practice. It is for reflection and self-development.
      </p>

      <h2>What it is not</h2>
      <ul>
        <li>It is <strong>not</strong> medical, mental health, legal or financial advice, and it does not replace a qualified professional. Do not delay or stop treatment, or make major legal or financial decisions, because of something the coach says.</li>
        <li>Astrology describes tendencies, not fixed outcomes. Nothing here is a prediction you are bound by.</li>
        <li>Replies are written by an AI model. They can be wrong, incomplete or misread your situation. Use your own judgement.</li>
      </ul>

      <h2>If you are in crisis</h2>
      <p>
        The coach is not an emergency service. If you are thinking about harming yourself, call Tele-MANAS on{" "}
        <strong>14416</strong> (free, 24×7, India) or <strong>112</strong> in an emergency. Outside India, call your local
        emergency number.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You must be at least {LEGAL.minimumAge} years old.</li>
        <li>Give accurate details, keep your password and devices secure, and tell us if you think someone else has used your account.</li>
        <li>Enter birth details only for yourself, or for someone who has agreed to it.</li>
      </ul>

      <h2>Fair use</h2>
      <p>Please do not:</p>
      <ul>
        <li>break the law, or use the service to harass, harm or deceive anyone;</li>
        <li>try to break, overload, scrape or reverse-engineer the service, or get around its usage limits;</li>
        <li>try to make the coach produce harmful content, or present its replies as professional advice to others.</li>
      </ul>
      <p>We may limit, suspend or close accounts that break these rules. There are daily limits on coaching to keep the service available for everyone.</p>

      <h2>Contributions</h2>
      <p>
        {LEGAL.productName} is free. You may choose to send a contribution by UPI if you find it useful. Contributions are
        voluntary gifts: they do not buy a subscription, unlock features or change the guidance you get, and they are not
        refundable except where the law requires. If you sent money by mistake, write to us and we will do our best to help.
      </p>

      <h2>Your content and ours</h2>
      <p>
        You own what you write. You let us store and process it only to run the service for you, as described in our{" "}
        <Link href="/privacy">Privacy Policy</Link>. The app, its design, text and code belong to {LEGAL.operator}. You
        may keep and share the guidance you receive for personal use.
      </p>

      <h2>Availability and changes</h2>
      <p>
        We work to keep the service running but do not promise it will always be available or error-free. We may change,
        pause or stop features. If we change these terms in a way that matters, we will tell you in the app before the
        change takes effect; continuing to use the service after that means you accept the new terms.
      </p>

      <h2>Liability</h2>
      <p>
        The service is provided &ldquo;as is&rdquo;. To the extent the law allows, we are not liable for decisions you make
        based on it, or for indirect or consequential loss. Nothing in these terms limits rights you have under Indian
        consumer law that cannot be excluded.
      </p>

      <h2>Ending</h2>
      <p>You can stop using the service at any time and ask us to delete your account. Sections that by their nature should continue (such as liability) survive.</p>

      <h2>Law and disputes</h2>
      <p>
        These terms are governed by the laws of India. Please write to us first so we can try to resolve any problem;
        otherwise the courts of India have jurisdiction.
      </p>

      <h2>Contact</h2>
      <p><a href={mail}>{LEGAL.contactEmail}</a></p>
    </LegalPage>
  );
}
