import { ADVICE_DISCLAIMER } from "@/lib/constants";

export default function AdviceDisclaimer({ className = "" }: { className?: string }) {
  return (
    <p className={`text-[10px] text-gray-500 dark:text-gray-400 text-center ${className}`.trim()}>
      {ADVICE_DISCLAIMER}
    </p>
  );
}
