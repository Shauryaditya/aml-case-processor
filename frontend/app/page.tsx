"use client";

import { useState, JSX } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Download,
  Copy,
  FileText,
  TrendingUp,
} from "lucide-react";
import IndicatorBadgesDemo from "./components/IndicatorBadgeDemo";
import { IndicatorBadge } from "./components/IndicatorBadge";

// Type definitions
interface Transaction {
  Date?: string;
  Type?: string;
  amount?: number;
  Details?: string;
  location_city?: string;
  location_country?: string;
  location_lat?: number;
  location_lng?: number;
}

interface Pattern {
  code: string;
  name: string;
}

interface CaseSummary {
  risk_band: string;
  main_driver: string;
  supporting_indicators: string[];
  recommendation: string;
}

interface ProcessingResult {
  transactions: Transaction[];
  patterns: Pattern[];
  risk_score: number;
  risk_band: string;
  final_recommendation: string;
  case_summary: CaseSummary;
  sar_text: string;
  location_summary?: string;
}

interface StatusResponse {
  status: string;
  error?: string;
}

interface UploadResponse {
  job_id: string;
}

// Mock pattern labels - replace with your actual import
const PATTERN_LABELS: Record<string, string> = {
  STRUCTURING_NEAR_THRESHOLD_CASH: "Structuring Near Threshold",
  ATM_STRUCTURING_WITHDRAWALS: "ATM Structuring",
  INBOUND_SMURFING: "Inbound Smurfing",
  SMURFING_P2P_INBOUND: "P2P Smurfing",
  P2P_MULTIPLE_TRANSFERS_SAME_DAY: "Multiple P2P Transfers",
  CRYPTO_TO_BANK_FLOW: "Crypto to Bank Flow",
  RAPID_OUTFLOW: "Rapid Outflow",
  RAPID_CASH_TO_WIRE: "Rapid Cash to Wire",
  HIGH_RISK_JURISDICTION_WIRE: "High Risk Jurisdiction",
  FUNNELING_ACTIVITY: "Funneling Activity",
  LAYERING_ACTIVITY: "Layering Activity",
};

export const INDICATOR_LABELS: Record<string, string> = {
  RAPID_OUTFLOW: "Rapid Movement of Funds",
  MULTIPLE_TRANSACTION_CHANNELS: "Multiple Transaction Channels Used",
  RAPID_SEQUENCE_OF_TRANSFERS: "Rapid Sequential Transfers",
  MULTIPLE_INBOUND_SOURCES: "Multiple Inbound Sources",
  AGGREGATION_OF_FUNDS: "Aggregation of Funds",
  SINGLE_EXIT_DESTINATION: "Single Exit Destination",
  DISTINCT_SENDERS: "Distinct Senders Detected",
};
// Priority levels for patterns
type PriorityLevel = "critical" | "high" | "medium" | "low";

const PATTERN_PRIORITY: Record<string, PriorityLevel> = {
  // Critical - Red
  FUNNELING_ACTIVITY: "critical",
  LAYERING_ACTIVITY: "critical",
  INBOUND_SMURFING: "critical",

  // High - Orange
  CRYPTO_TO_BANK_FLOW: "high",
  RAPID_OUTFLOW: "high",
  STRUCTURING_NEAR_THRESHOLD_CASH: "high",
  ATM_STRUCTURING_WITHDRAWALS: "high",

  // Medium - Yellow
  SMURFING_P2P_INBOUND: "medium",
  P2P_MULTIPLE_TRANSFERS_SAME_DAY: "medium",
  RAPID_CASH_TO_WIRE: "medium",

  // Low - Blue
  HIGH_RISK_JURISDICTION_WIRE: "low",
};

// Mock transaction table component
function TransactionTable({ transactions }: { transactions: Transaction[] }) {
  console.log("Transactions:", transactions);
  if (!transactions?.length) return null;

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700">
        Recent Transactions ({transactions.length})
      </div>
      <div className="max-h-48 overflow-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2 text-right">Details</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((txn, i) => (
              <tr key={i} className="border-t hover:bg-gray-50">
                <td className="px-3 py-2">{txn?.Date || "-"}</td>
                <td className="px-3 py-2">{txn.Type || "-"}</td>
                <td className="px-3 py-2 text-right">{txn.amount || "0"}</td>
                <td className="px-3 py-2 text-right">{txn.Details || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Simplified World Map SVG Path (Mercator-ish)
const WORLD_MAP_PATH = "M158.4,124.6c-1.3-3.6-4.5-5.9-4.2-7.5c0.3-1.6,3.6-1.5,5.6-2.5c2-1,2.6-3.7,1.9-5.7c-0.7-2-2.9-2.8-5.2-2.1c-2.3,0.7-4.9-0.1-6.7-1.8c-1.8-1.7-2.6-4.4-1.6-6.7c1-2.3,3.7-3.3,6.1-2.9c2.4,0.4,4.2,2.3,5.6,4.5c1.4,2.2,2.6,4.8,4.7,6.3c2.1,1.5,4.9,1.7,7.2,0.4c2.3-1.3,3.6-3.8,4.8-6.2c1.2-2.4,2.2-5,3.9-7.1c1.7-2.1,4.4-3.1,7-3.2c2.6-0.1,5.2,0.8,7.3,2.4c2.1,1.6,3.4,4,4.7,6.3c1.3,2.3,2.7,4.6,4.7,6.3c2,1.7,4.4,2.7,7,2.8c2.6,0.1,5.2-0.8,7.3-2.3c2.1-1.5,3.4-3.9,4.8-6.2c1.4-2.3,2.9-4.5,4.9-6c2-1.5,4.5-2.2,7-2.1c2.5,0.1,5,1.2,6.7,3c1.7,1.8,2.8,4.3,3.3,6.8c0.5,2.5,0.4,5.1-0.5,7.5c-0.9,2.4-2.5,4.5-4.4,6.2c-1.9,1.7-4.2,2.9-6.6,3.6c-2.4,0.7-5,0.8-7.5,0.2c-2.5-0.6-4.8-2-6.6-3.9c-1.8-1.9-2.9-4.3-3.9-6.8c-1-2.5-1.9-5.1-3.6-7c-1.7-1.9-4.2-2.7-6.7-2.6c-2.5,0.1-4.9,1.1-6.7,2.9c-1.8,1.8-2.9,4.2-3.8,6.8c-0.9,2.6-1.7,5.2-3.3,7.3c-1.6,2.1-3.9,3.5-6.5,4c-2.6,0.5-5.3-0.1-7.6-1.4c-2.3-1.3-4.1-3.4-5.3-5.8c-1.2-2.4-1.6-5.1-1.3-7.8c0.3-2.7,1.4-5.2,3-7.4";

function LocationIntelligenceSection({ result }: { result: ProcessingResult }) {
  if (!result || !result.transactions) return null;

  // Extract valid locations
  const locations = result.transactions
    .filter((t) => t.location_lat && t.location_lng)
    .map((t) => ({
      city: t.location_city,
      country: t.location_country,
      lat: t.location_lat!,
      lng: t.location_lng!,
    }));

  const uniqueLocations = Array.from(new Set(locations.map(l => `${l.city}|${l.country}`)))
    .map(key => {
      const [city, country] = key.split('|');
      const loc = locations.find(l => l.city === city && l.country === country);
      return loc;
    });

  if (uniqueLocations.length === 0 && !result.location_summary) return null;

  return (
    <Card className="bg-white shadow-xl border-0 mb-6">
      <CardHeader className="border-b bg-gradient-to-r from-indigo-50 to-purple-50">
        <CardTitle className="flex items-center gap-2 text-indigo-900">
          <TrendingUp className="h-5 w-5 text-indigo-600" />
          Location Intelligence
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Summary & Metrics */}
          <div className="md:col-span-1 space-y-4">
             <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-lg">
                <h4 className="text-sm font-semibold text-indigo-900 mb-2">Geographic Summary</h4>
                <p className="text-sm text-indigo-800 leading-relaxed">
                  {result.location_summary || "No specific location patterns detected."}
                </p>
             </div>
             
             {uniqueLocations.length > 0 && (
               <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Identified Locations</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                    {uniqueLocations.map((loc, i) => (
                      <div key={i} className="flex justify-between items-center text-sm border-b border-gray-100 pb-1">
                        <span className="font-medium text-gray-700">{loc?.city}</span>
                        <span className="text-xs text-gray-500">{loc?.country}</span>
                      </div>
                    ))}
                  </div>
               </div>
             )}
          </div>

          {/* Map Visualization */}
          <div className="md:col-span-2 bg-gray-50 rounded-xl border border-gray-200 relative overflow-hidden h-64 flex items-center justify-center">
             {uniqueLocations.length > 0 ? (
               <div className="relative w-full h-full p-4">
                  <svg viewBox="0 0 360 180" className="w-full h-full opacity-60">
                    {/* Background Placeholders for Continents (abstract) */}
                    <path d="M50 40 L120 40 L130 90 L80 120 Z" fill="#e5e7eb" /> {/* Americas */}
                    <path d="M160 30 L280 30 L270 90 L180 100 Z" fill="#e5e7eb" /> {/* Eurasia */}
                    <path d="M170 90 L230 90 L220 140 L180 130 Z" fill="#e5e7eb" /> {/* Africa */}
                    <rect x="0" y="0" width="360" height="180" fill="none" stroke="#e5e7eb" strokeWidth="0.5" />
                  </svg>
                  
                  {/* Points */}
                  {uniqueLocations.map((loc, i) => {
                     // Simple Equirectangular projection
                     // lng: -180 to 180 -> x: 0 to 360
                     // lat: 90 to -90 -> y: 0 to 180
                     const x = (loc!.lng + 180); 
                     const y = (90 - loc!.lat); 
                     return (
                       <div 
                         key={i}
                         className="absolute w-3 h-3 bg-red-500 rounded-full border-2 border-white shadow-md transform -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
                         style={{ left: `${(x/360)*100}%`, top: `${(y/180)*100}%` }}
                         title={`${loc?.city}, ${loc?.country}`}
                       >
                         <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">
                           {loc?.city}, {loc?.country}
                         </span>
                       </div>
                     );
                  })}
               </div>
             ) : (
                <div className="text-gray-400 text-sm italic">Map view unavailable (No coordinates found)</div>
             )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Home() {

  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressText, setProgressText] = useState<string>("");
  const [jobId, setJobId] = useState<string | null>(null);

  const backendUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

  async function processCase(): Promise<void> {
    if (!file) return;
    setIsProcessing(true);
    setProgressText("Uploading file...");
    setJobId(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch(`${backendUrl}/api/upload`, {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) throw new Error("Upload failed");

      const uploadData: UploadResponse = await uploadRes.json();
      const newJobId = uploadData.job_id;
      setJobId(newJobId);
      setProgressText("Analyzing case… this usually takes a few seconds");

      let done = false;
      while (!done) {
        await new Promise((r) => setTimeout(r, 1200));

        const statusRes = await fetch(`${backendUrl}/api/status/${newJobId}`);
        if (!statusRes.ok) throw new Error("Status fetch failed");

        const statusJson: StatusResponse = await statusRes.json();

        if (statusJson.error)
          throw new Error(statusJson.error || "Backend error");

        const st = statusJson.status;
        if (st === "done") {
          done = true;
          break;
        } else if (st === "error") {
          throw new Error(statusJson.error || "Processing error");
        } else {
          setProgressText(
            st === "rules"
              ? "Running pattern engine…"
              : st === "llm"
              ? "Generating SAR narrative…"
              : st === "pdf"
              ? "Creating final SAR report…"
              : "Processing…"
          );
        }
      }

      const resultRes = await fetch(`${backendUrl}/api/result/${newJobId}`);
      if (!resultRes.ok) throw new Error("Result fetch failed");
      const resultJson: ProcessingResult = await resultRes.json();
      setResult(resultJson);
    } catch (err) {
      console.error(err);
      const errorMessage =
        err instanceof Error ? err.message : "Processing error";
      alert(errorMessage);
    } finally {
      setIsProcessing(false);
      setProgressText("");
    }
  }

  function getRiskColor(band: string): string {
    if (!band) return "bg-gray-200 text-gray-800";
    const b = band.toLowerCase();
    if (b === "high")
      return "bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg shadow-red-200";
    if (b === "medium")
      return "bg-gradient-to-r from-yellow-400 to-yellow-500 text-gray-900 shadow-lg shadow-yellow-200";
    return "bg-gradient-to-r from-green-600 to-green-700 text-white shadow-lg shadow-green-200";
  }

  function getRiskIcon(band: string): JSX.Element | null {
    if (!band) return null;
    const b = band.toLowerCase();
    if (b === "high") return <AlertTriangle className="h-5 w-5" />;
    if (b === "medium") return <AlertCircle className="h-5 w-5" />;
    return <CheckCircle2 className="h-5 w-5" />;
  }

  function getPatternBadgeStyle(code: string): string {
    const priority: PriorityLevel = PATTERN_PRIORITY[code] || "low";

    switch (priority) {
      case "critical":
        return "bg-red-100 text-red-800 border border-red-300 font-semibold shadow-sm";
      case "high":
        return "bg-orange-100 text-orange-800 border border-orange-300 font-medium shadow-sm";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border border-yellow-300";
      case "low":
        return "bg-blue-100 text-blue-800 border border-blue-300";
      default:
        return "bg-gray-100 text-gray-800 border border-gray-300";
    }
  }

  function getRecommendationStyle(rec: string): string {
    if (!rec) return "bg-gray-100 text-gray-800";
    const r = rec.toLowerCase();
    if (r === "sar")
      return "bg-red-50 text-red-700 border-2 border-red-300 font-bold";
    if (r === "review")
      return "bg-yellow-50 text-yellow-700 border-2 border-yellow-300 font-semibold";
    if (r === "no sar")
      return "bg-green-50 text-green-700 border-2 border-green-300 font-medium";
    return "bg-gray-100 text-gray-800";
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 via-blue-50 to-gray-50 text-gray-900 p-6">
      {/* HERO */}
      <div className="max-w-6xl mx-auto text-center mb-10">
        <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
          <TrendingUp className="h-4 w-4" />
          AI-Powered AML Detection
        </div>
        <h1 className="text-5xl font-bold bg-linear-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          AML Case Processor
        </h1>
        <p className="text-gray-600  max-w-2xl mx-auto text-lg">
          Upload a case file and instantly detect AML patterns, risk scoring,
          and a SAR-ready narrative powered by advanced pattern recognition.
        </p>
        <p className="text-sm text-gray-500 mt-2">
          Supports CSV, XLSX, PDF • Secure & Private
        </p>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* UPLOAD PANEL */}
        <Card className="bg-white shadow-xl border-0 lg:col-span-1">
          <CardHeader className="bg-linear-to-r text-black">
            <CardTitle className="flex items-center gap-2 py-0">
              <FileText className="h-5 w-5" />
              Upload Case File
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 ">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Select Transaction File
              </label>
              <Input
                type="file"
                accept=".csv,.xlsx,.xls,.pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="cursor-pointer"
              />
              <p className="text-xs text-gray-500 mt-2">
                CSV, XLSX, or PDF format accepted
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-700 font-medium">
                🔒 Privacy Guaranteed
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Files are processed in memory only and never stored
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs text-amber-800 font-medium">
                ⚠️ Important Notice
              </p>
              <p className="text-xs text-amber-700 mt-1">
                This analysis is intended to support AML review and does not
                replace investigator judgment.
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={processCase}
                disabled={!file || isProcessing}
                className="flex-1 bg-linear-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Analyze Case"
                )}
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  setFile(null);
                  setResult(null);
                }}
                className="border-2"
              >
                Reset
              </Button>
            </div>

            {isProcessing && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  <span className="text-sm text-gray-700 font-medium">
                    {progressText}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* RESULTS SECTION */}
        <div className="lg:col-span-2 space-y-6">
          {/* CASE SUMMARY - Prominent Display */}
          {result?.case_summary && (
            <Card className="border-0 shadow-2xl bg-linear-to-br from-white to-gray-50">
              <CardHeader className="border-b-4 border-blue-600">
                <CardTitle className="text-2xl flex items-center gap-2">
                  <AlertCircle className="h-6 w-6 text-blue-600" />
                  Case Summary
                </CardTitle>
              </CardHeader>

              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Risk Band - Large Display */}
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-gray-600 uppercase tracking-wide">
                      Risk Assessment
                    </div>
                    <div
                      className={`px-6 py-4 rounded-xl flex items-center gap-3 ${getRiskColor(
                        result.case_summary.risk_band
                      )}`}
                    >
                      {getRiskIcon(result.case_summary.risk_band)}
                      <div>
                        <div className="text-2xl font-bold">
                          {result.case_summary.risk_band}
                        </div>
                        <div className="text-sm opacity-90">Risk Level</div>
                      </div>
                    </div>
                  </div>

                  {/* Recommendation */}
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-gray-600 uppercase tracking-wide">
                      Recommendation
                    </div>
                    <div
                      className={`px-6 py-4 rounded-xl text-center ${getRecommendationStyle(
                        result.case_summary.recommendation
                      )}`}
                    >
                      <div className="text-2xl font-bold">
                        {result.case_summary.recommendation}
                      </div>
                      <div className="text-sm mt-1">Action Required</div>
                    </div>
                  </div>
                </div>

                {/* Main Driver */}
                <div className="mt-6 p-4 bg-red-50 border-l-4 border-red-600 rounded-r-lg">
                  <div className="text-sm font-semibold text-red-900 mb-1">
                    Primary SAR Driver
                  </div>
                  <div className="text-lg font-bold text-red-700">
                    {PATTERN_LABELS[result?.case_summary?.main_driver] ||
                      result?.case_summary?.main_driver ||
                      "None"}
                  </div>
                </div>

                {/* Supporting Indicators */}
                    <div className="flex flex-wrap gap-2">
                      {result.case_summary.supporting_indicators?.length >
                        0 && (
                        <div className="mt-4">
                          <div className="text-sm font-semibold text-gray-700 mb-3">
                            Supporting Indicators
                          </div>
                          <div className="flex flex-wrap gap-3">
                            {result.case_summary.supporting_indicators.map(
                              (code: string) => (
                                <IndicatorBadge key={code} code={code} />
                              )
                            )}
                          </div>
                        </div>
                      )}
                    </div>
              </CardContent>
            </Card>
          )}

          {/* Location Intelligence */}
          {result && <LocationIntelligenceSection result={result} />}

          {/* DETAILED RESULTS */}
          <Card className="bg-white shadow-xl border-0">
            <CardHeader className=" border-b">
              <CardTitle>Detailed Analysis</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {isProcessing ? (
                <div className="flex flex-col items-center justify-center gap-4 py-12">
                  <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
                  <div className="text-lg font-medium text-gray-700">
                    {progressText || "Processing..."}
                  </div>
                  <div className="text-sm text-gray-500">
                    Please wait while we analyze your case
                  </div>
                </div>
              ) : !result ? (
                <div className="text-center py-12">
                  <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <div className="text-lg font-medium text-gray-600">
                    No Case Processed Yet
                  </div>
                  <div className="text-sm text-gray-500 mt-2">
                    Upload a file and click "Analyze Case" to begin
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Job ID & Metrics */}
                  <div className="flex items-center justify-between text-xs text-gray-500 pb-4 border-b">
                    <span>Job ID: {jobId ?? "-"}</span>
                    <div className="flex items-center gap-4">
                      <span>
                        Risk Score:{" "}
                        <span className="font-bold text-gray-900">
                          {result.risk_score ?? "-"}
                        </span>{" "}
                        / 10
                      </span>
                    </div>
                  </div>

                  {/* All Patterns Detected */}
                  <div>
                    <div className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-600" />
                      All Detected Patterns ({result.patterns?.length || 0})
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {result.patterns?.length ? (
                        result.patterns.map((p: Pattern, i: number) => (
                          <span
                            key={i}
                            className={`px-3 py-2 rounded-lg text-xs ${getPatternBadgeStyle(
                              p.code
                            )}`}
                          >
                            {p.name}
                          </span>
                        ))
                      ) : (
                        <div className="text-sm text-gray-500 italic">
                          No patterns detected
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Transactions */}
                  <TransactionTable transactions={result.transactions} />

                  {/* SAR Narrative */}
                  <div>
                    <div className="text-sm font-semibold text-gray-700 mb-3">
                      SAR Narrative (Draft)
                    </div>
                    <div className="border-2 border-gray-200 rounded-lg p-4 bg-gray-50 max-h-60 overflow-auto text-sm whitespace-pre-wrap font-mono">
                      {result.sar_text || "No narrative generated"}
                    </div>

                    <div className="flex gap-3 mt-4">
                      <Button
                        onClick={() =>
                          navigator.clipboard.writeText(result.sar_text || "")
                        }
                        className="flex-1 bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50"
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        Copy Narrative
                      </Button>

                      <Button
                        onClick={() => {
                          if (!jobId) return;
                          window.open(
                            `${backendUrl}/api/download/${jobId}`,
                            "_blank"
                          );
                        }}
                        className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download PDF
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
