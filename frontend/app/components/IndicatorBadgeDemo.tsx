import React from "react";
import {
  AlertTriangle,
  TrendingUp,
  Users,
  Target,
  Layers,
  ArrowRightLeft,
} from "lucide-react";

// Indicator badge configuration with icons and styling
const INDICATOR_CONFIG = {
  RAPID_OUTFLOW: {
    label: "Rapid Movement of Funds",
    icon: TrendingUp,
    gradient: "from-red-500 to-orange-500",
    bg: "bg-red-50",
    border: "border-red-300",
    text: "text-red-800",
    iconColor: "text-red-600",
  },
  MULTIPLE_TRANSACTION_CHANNELS: {
    label: "Multiple Transaction Channels",
    icon: Layers,
    gradient: "from-purple-500 to-pink-500",
    bg: "bg-purple-50",
    border: "border-purple-300",
    text: "text-purple-800",
    iconColor: "text-purple-600",
  },
  RAPID_SEQUENCE_OF_TRANSFERS: {
    label: "Rapid Sequential Transfers",
    icon: ArrowRightLeft,
    gradient: "from-orange-500 to-red-500",
    bg: "bg-orange-50",
    border: "border-orange-300",
    text: "text-orange-800",
    iconColor: "text-orange-600",
  },
  MULTIPLE_INBOUND_SOURCES: {
    label: "Multiple Inbound Sources",
    icon: Users,
    gradient: "from-blue-500 to-cyan-500",
    bg: "bg-blue-50",
    border: "border-blue-300",
    text: "text-blue-800",
    iconColor: "text-blue-600",
  },
  AGGREGATION_OF_FUNDS: {
    label: "Aggregation of Funds",
    icon: Target,
    gradient: "from-indigo-500 to-purple-500",
    bg: "bg-indigo-50",
    border: "border-indigo-300",
    text: "text-indigo-800",
    iconColor: "text-indigo-600",
  },
  SINGLE_EXIT_DESTINATION: {
    label: "Single Exit Destination",
    icon: Target,
    gradient: "from-yellow-500 to-orange-500",
    bg: "bg-yellow-50",
    border: "border-yellow-300",
    text: "text-yellow-800",
    iconColor: "text-yellow-600",
  },
  DISTINCT_SENDERS: {
    label: "Distinct Senders Detected",
    icon: Users,
    gradient: "from-teal-500 to-emerald-500",
    bg: "bg-teal-50",
    border: "border-teal-300",
    text: "text-teal-800",
    iconColor: "text-teal-600",
  },
};

// Component for a single indicator badge
function IndicatorBadge({ code }: { code: string }) {
  const config = INDICATOR_CONFIG[code as keyof typeof INDICATOR_CONFIG];

  if (!config) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 border border-gray-300">
        <span className="text-xs font-medium text-gray-700">{code}</span>
      </div>
    );
  }

  const Icon = config.icon;

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-2.5 rounded-lg ${config.bg} border-2 ${config.border} shadow-sm hover:shadow-md transition-all duration-200 group`}
    >
      <div className={`p-1 rounded-md bg-linear-to-br ${config.gradient}`}>
        <Icon className="h-3.5 w-3.5 text-white" />
      </div>
      <span
        className={`text-xs font-semibold ${config.text} group-hover:scale-105 transition-transform`}
      >
        {config.label}
      </span>
    </div>
  );
}

// Demo component showing all badge styles
export default function IndicatorBadgesDemo() {
  const indicators = Object.keys(INDICATOR_CONFIG);

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 via-blue-50 to-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-medium mb-4">
            <AlertTriangle className="h-4 w-4" />
            Supporting Indicators Design System
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Enhanced Badge Components
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Visual hierarchy and clear categorization for AML pattern indicators
          </p>
        </div>

        {/* Compact Grid View (Recommended for UI) */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-1 h-6 bg-blue-600 rounded-full"></span>
            Compact Grid Layout
          </h2>
          <p className="text-sm text-gray-600 mb-6">
            Recommended for case summary sections
          </p>

          <div className="flex flex-wrap gap-3">
            {indicators.map((code) => (
              <IndicatorBadge key={code} code={code} />
            ))}
          </div>
        </div>

        {/* List View with Descriptions */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-1 h-6 bg-purple-600 rounded-full"></span>
            Detailed List View
          </h2>
          <p className="text-sm text-gray-600 mb-6">
            Alternative layout with more context
          </p>

          <div className="space-y-3">
            {indicators.map((code) => {
              const config =
                INDICATOR_CONFIG[code as keyof typeof INDICATOR_CONFIG];
              const Icon = config.icon;

              return (
                <div
                  key={code}
                  className={`flex items-center gap-4 p-4 rounded-lg ${config.bg} border ${config.border} hover:shadow-md transition-all`}
                >
                  <div
                    className={`p-2 rounded-lg bg-linear-to-br ${config.gradient} shadow-sm`}
                  >
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className={`font-semibold ${config.text} text-sm`}>
                      {config.label}
                    </div>
                    <div className="text-xs text-gray-600 mt-0.5">
                      Pattern indicator detected in transaction analysis
                    </div>
                  </div>
                  <div
                    className={`px-3 py-1 rounded-full ${config.bg} border ${config.border} text-xs font-medium ${config.text}`}
                  >
                    Active
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Category-based Grouping */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-1 h-6 bg-green-600 rounded-full"></span>
            Categorized View
          </h2>
          <p className="text-sm text-gray-600 mb-6">
            Grouped by indicator type
          </p>

          <div className="space-y-6">
            {/* Movement Patterns */}
            <div>
              <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                Movement Patterns
              </h3>
              <div className="flex flex-wrap gap-2">
                <IndicatorBadge code="RAPID_OUTFLOW" />
                <IndicatorBadge code="RAPID_SEQUENCE_OF_TRANSFERS" />
                <IndicatorBadge code="MULTIPLE_TRANSACTION_CHANNELS" />
              </div>
            </div>

            {/* Source Patterns */}
            <div>
              <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                Source Patterns
              </h3>
              <div className="flex flex-wrap gap-2">
                <IndicatorBadge code="MULTIPLE_INBOUND_SOURCES" />
                <IndicatorBadge code="DISTINCT_SENDERS" />
              </div>
            </div>

            {/* Fund Behavior */}
            <div>
              <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                Fund Behavior
              </h3>
              <div className="flex flex-wrap gap-2">
                <IndicatorBadge code="AGGREGATION_OF_FUNDS" />
                <IndicatorBadge code="SINGLE_EXIT_DESTINATION" />
              </div>
            </div>
          </div>
        </div>

        {/* Usage Code */}
        <div className="bg-gray-900 rounded-xl shadow-lg p-8 mt-8">
          <h2 className="text-xl font-bold text-white mb-4">Usage Example</h2>
          <pre className="text-green-400 text-xs overflow-x-auto">
            {`// In your case summary section:
{result.case_summary.supporting_indicators?.length > 0 && (
  <div className="mt-4">
    <div className="text-sm font-semibold text-gray-700 mb-3">
      Supporting Indicators
    </div>
    <div className="flex flex-wrap gap-3">
      {result.case_summary.supporting_indicators.map(code => (
        <IndicatorBadge key={code} code={code} />
      ))}
    </div>
  </div>
)}`}
          </pre>
        </div>
      </div>
    </div>
  );
}
