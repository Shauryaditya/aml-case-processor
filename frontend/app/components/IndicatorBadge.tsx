import React from 'react';
import { AlertTriangle, TrendingUp, Users, Target, Layers, ArrowRightLeft } from 'lucide-react';

const INDICATOR_CONFIG = {
  RAPID_OUTFLOW: {
    label: "Rapid Movement of Funds",
    icon: TrendingUp,
    gradient: "from-red-500 to-orange-500",
    bg: "bg-red-50",
    border: "border-red-300",
    text: "text-red-800",
    iconColor: "text-red-600"
  },
    P2P_MULTIPLE_TRANSFERS_SAME_DAY: {
    label: "Multiple P2P Transfers Same Day",
    icon: TrendingUp,
    gradient: "from-yellow-500 to-orange-500",
    bg: "bg-yellow-50",
    border: "border-yellow-300",
    text: "text-yellow-800",
    iconColor: "text-yellow-600"
  },
  ATM_STRUCTURING_WITHDRAWALS: {
    label: "ATM Structuring Withdrawals",
    icon: AlertTriangle,
    gradient: "from-orange-600 to-orange-400",
    bg: "bg-red-100",
    border: "border-red-400",
    text: "text-red-900",
    iconColor: "text-red-700"
  },

  MULTIPLE_TRANSACTION_CHANNELS: {
    label: "Multiple Transaction Channels",
    icon: Layers,
    gradient: "from-purple-500 to-pink-500",
    bg: "bg-purple-50",
    border: "border-purple-300",
    text: "text-purple-800",
    iconColor: "text-purple-600"
  },
  RAPID_CASH_TO_WIRE: {
    label: "Rapid Cash to Wire Transfers",
    icon: ArrowRightLeft,
    gradient: "from-red-600 to-yellow-500",
    bg: "bg-red-100",
    border: "border-red-400",
    text: "text-red-900",
    iconColor: "text-red-700"
  },
  RAPID_SEQUENCE_OF_TRANSFERS: {
    label: "Rapid Sequential Transfers",
    icon: ArrowRightLeft,
    gradient: "from-orange-500 to-red-500",
    bg: "bg-orange-50",
    border: "border-orange-300",
    text: "text-orange-800",
    iconColor: "text-orange-600"
  },
  MULTIPLE_INBOUND_SOURCES: {
    label: "Multiple Inbound Sources",
    icon: Users,
    gradient: "from-blue-500 to-cyan-500",
    bg: "bg-blue-50",
    border: "border-blue-300",
    text: "text-blue-800",
    iconColor: "text-blue-600"
  },
  AGGREGATION_OF_FUNDS: {
    label: "Aggregation of Funds",
    icon: Target,
    gradient: "from-indigo-500 to-purple-500",
    bg: "bg-indigo-50",
    border: "border-indigo-300",
    text: "text-indigo-800",
    iconColor: "text-indigo-600"
  },
  SINGLE_EXIT_DESTINATION: {
    label: "Single Exit Destination",
    icon: Target,
    gradient: "from-yellow-500 to-orange-500",
    bg: "bg-yellow-50",
    border: "border-yellow-300",
    text: "text-yellow-800",
    iconColor: "text-yellow-600"
  },
  CRYPTO_TO_BANK_FLOW: {
    label: "Crypto to Bank Flow",
    icon: TrendingUp,
    gradient: "from-green-500 to-lime-500",
    bg: "bg-green-50",
    border: "border-green-300",
    text: "text-green-800",
    iconColor: "text-green-600"
  },
  LAYERING_ACTIVITY: {
    label: "Layering Activity Detected",
    icon: Layers,
    gradient: "from-pink-500 to-purple-500",
    bg: "bg-pink-50",
    border: "border-pink-300",
    text: "text-pink-800",
    iconColor: "text-pink-600"
  },
  DISTINCT_SENDERS: {
    label: "Distinct Senders Detected",
    icon: Users,
    gradient: "from-teal-500 to-emerald-500",
    bg: "bg-teal-50",
    border: "border-teal-300",
    text: "text-teal-800",
    iconColor: "text-teal-600"
  }
};

export function IndicatorBadge({ code }: { code: string }) {
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
    <div className={`inline-flex items-center gap-2 px-3 py-2.5 rounded-lg ${config.bg} border-2 ${config.border} shadow-sm hover:shadow-md transition-all duration-200 group`}>
      <div className={`p-1 rounded-md bg-gradient-to-br ${config.gradient}`}>
        <Icon className="h-3.5 w-3.5 text-white" />
      </div>
      <span className={`text-xs font-semibold ${config.text} group-hover:scale-105 transition-transform`}>
        {config.label}
      </span>
    </div>
  );
}