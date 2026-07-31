"use client";

import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";

interface Props {
  /** Human-readable feature name, e.g. "Coaching", "Your Foundation". */
  feature: string;
}

export default function SignInRequired({ feature }: Props) {
  const router = useRouter();

  return (
    <div className="min-h-[50vh] flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Lock className="w-5 h-5 text-indigo-600" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Sign in to unlock {feature}</h2>
        <p className="text-sm text-gray-500 mb-5">
          Your chart is saved on this device. Create a free account to unlock {feature.toLowerCase()} and sync across devices.
        </p>
        <button
          onClick={() => router.push("/auth/signin")}
          className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          Sign in
        </button>
      </div>
    </div>
  );
}
