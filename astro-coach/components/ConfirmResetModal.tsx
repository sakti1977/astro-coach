"use client";

interface Props {
  onArchiveAndReplace: () => void;
  onReplaceOnly: () => void;
  onCancel: () => void;
}

/**
 * Shown when the user submits a new birth chart while existing chart data
 * (coaching history, habits, validation) is already saved locally.
 */
export default function ConfirmResetModal({ onArchiveAndReplace, onReplaceOnly, onCancel }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-gray-100">
        {/* Icon */}
        <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center mx-auto mb-4">
          <span className="text-amber-500 text-2xl">⚠</span>
        </div>

        <h2 className="text-lg font-bold text-gray-900 text-center mb-2">
          Replace existing chart?
        </h2>
        <p className="text-sm text-gray-500 text-center leading-relaxed mb-6">
          You have an existing chart with coaching history, habits, and validation
          data. Replacing it will permanently remove all of that for the current
          browser session.
        </p>

        <div className="space-y-3">
          {/* Primary: archive then replace */}
          <button
            onClick={onArchiveAndReplace}
            className="w-full bg-indigo-600 text-white py-3 px-4 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200"
          >
            Archive &amp; Replace
            <span className="block text-xs font-normal text-indigo-200 mt-0.5">
              Save a backup of current data, then load new chart
            </span>
          </button>

          {/* Secondary: replace without archiving */}
          <button
            onClick={onReplaceOnly}
            className="w-full border border-gray-200 text-gray-700 py-3 px-4 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Replace without archiving
          </button>

          {/* Cancel */}
          <button
            onClick={onCancel}
            className="w-full text-gray-400 py-2 text-sm hover:text-gray-600 transition-colors"
          >
            Cancel — keep existing chart
          </button>
        </div>
      </div>
    </div>
  );
}
