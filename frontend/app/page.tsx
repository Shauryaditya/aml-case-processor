"use client";

import { useState, JSX } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, AlertTriangle, CheckCircle2, AlertCircle, Download, Copy, FileText, TrendingUp } from "lucide-react";

// Type definitions
interface Transaction {
  Date?: string;
  Type?: string;
  amount?: number;
  Details?: string;
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
  "STRUCTURING_NEAR_THRESHOLD_CASH": "Structuring Near Threshold",
  "ATM_STRUCTURING_WITHDRAWALS": "ATM Structuring",
  "INBOUND_SMURFING": "Inbound Smurfing",
  "SMURFING_P2P_INBOUND": "P2P Smurfing",
  "P2P_MULTIPLE_TRANSFERS_SAME_DAY": "Multiple P2P Transfers",
  "CRYPTO_TO_BANK_FLOW": "Crypto to Bank Flow",
  "RAPID_OUTFLOW": "Rapid Outflow",
  "RAPID_CASH_TO_WIRE": "Rapid Cash to Wire",
  "HIGH_RISK_JURISDICTION_WIRE": "High Risk Jurisdiction",
  "FUNNELING_ACTIVITY": "Funneling Activity",
  "LAYERING_ACTIVITY": "Layering Activity",
};

// Priority levels for patterns
type PriorityLevel = "critical" | "high" | "medium" | "low";

const PATTERN_PRIORITY: Record<string, PriorityLevel> = {
  // Critical - Red
  "FUNNELING_ACTIVITY": "critical",
  "LAYERING_ACTIVITY": "critical",
  "INBOUND_SMURFING": "critical",
  
  // High - Orange
  "CRYPTO_TO_BANK_FLOW": "high",
  "RAPID_OUTFLOW": "high",
  "STRUCTURING_NEAR_THRESHOLD_CASH": "high",
  "ATM_STRUCTURING_WITHDRAWALS": "high",
  
  // Medium - Yellow
  "SMURFING_P2P_INBOUND": "medium",
  "P2P_MULTIPLE_TRANSFERS_SAME_DAY": "medium",
  "RAPID_CASH_TO_WIRE": "medium",
  
  // Low - Blue
  "HIGH_RISK_JURISDICTION_WIRE": "low",
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
                <td className="px-3 py-2 text-right">${txn.amount || "0"}</td>
                <td className="px-3 py-2 text-right">{txn.Details || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressText, setProgressText] = useState<string>("");
  const [jobId, setJobId] = useState<string | null>(null);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

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

        if (statusJson.error) throw new Error(statusJson.error || "Backend error");

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
      const errorMessage = err instanceof Error ? err.message : "Processing error";
      alert(errorMessage);
    } finally {
      setIsProcessing(false);
      setProgressText("");
    }
  }

  function getRiskColor(band: string): string {
    if (!band) return "bg-gray-200 text-gray-800";
    const b = band.toLowerCase();
    if (b === "high") return "bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg shadow-red-200";
    if (b === "medium") return "bg-gradient-to-r from-yellow-400 to-yellow-500 text-gray-900 shadow-lg shadow-yellow-200";
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
    
    switch(priority) {
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
    if (r === "sar") return "bg-red-50 text-red-700 border-2 border-red-300 font-bold";
    if (r === "review") return "bg-yellow-50 text-yellow-700 border-2 border-yellow-300 font-semibold";
    if (r === "no sar") return "bg-green-50 text-green-700 border-2 border-green-300 font-medium";
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
          Upload a case file and instantly detect AML patterns, risk scoring, and a SAR-ready narrative powered by advanced pattern recognition.
        </p>
        <p className="text-sm text-gray-500 mt-2">Supports CSV, XLSX, PDF • Secure & Private</p>
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
                This analysis is intended to support AML review and does not replace investigator judgment.
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
                  <span className="text-sm text-gray-700 font-medium">{progressText}</span>
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
                    <div className="text-sm font-medium text-gray-600 uppercase tracking-wide">Risk Assessment</div>
                    <div className={`px-6 py-4 rounded-xl flex items-center gap-3 ${getRiskColor(result.case_summary.risk_band)}`}>
                      {getRiskIcon(result.case_summary.risk_band)}
                      <div>
                        <div className="text-2xl font-bold">{result.case_summary.risk_band}</div>
                        <div className="text-sm opacity-90">Risk Level</div>
                      </div>
                    </div>
                  </div>

                  {/* Recommendation */}
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-gray-600 uppercase tracking-wide">Recommendation</div>
                    <div className={`px-6 py-4 rounded-xl text-center ${getRecommendationStyle(result.case_summary.recommendation)}`}>
                      <div className="text-2xl font-bold">{result.case_summary.recommendation}</div>
                      <div className="text-sm mt-1">Action Required</div>
                    </div>
                  </div>
                </div>

                {/* Main Driver */}
                <div className="mt-6 p-4 bg-red-50 border-l-4 border-red-600 rounded-r-lg">
                  <div className="text-sm font-semibold text-red-900 mb-1">Primary SAR Driver</div>
                  <div className="text-lg font-bold text-red-700">
                    {PATTERN_LABELS[result?.case_summary?.main_driver] || result?.case_summary?.main_driver || "None"}
                  </div>
                </div>

                {/* Supporting Indicators */}
                {result.case_summary.supporting_indicators?.length > 0 && (
                  <div className="mt-4">
                    <div className="text-sm font-semibold text-gray-700 mb-3">Supporting Indicators</div>
                    <div className="flex flex-wrap gap-2">
                      {result.case_summary.supporting_indicators.map((code: string, idx: number) => (
                        <span
                          key={idx}
                          className={`px-3 py-1.5 rounded-lg text-xs ${getPatternBadgeStyle(code)}`}
                        >
                          {PATTERN_LABELS[code] || code}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* DETAILED RESULTS */}
          <Card className="bg-white shadow-xl border-0">
            <CardHeader className=" border-b">
              <CardTitle>Detailed Analysis</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {isProcessing ? (
                <div className="flex flex-col items-center justify-center gap-4 py-12">
                  <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
                  <div className="text-lg font-medium text-gray-700">{progressText || "Processing..."}</div>
                  <div className="text-sm text-gray-500">Please wait while we analyze your case</div>
                </div>
              ) : !result ? (
                <div className="text-center py-12">
                  <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <div className="text-lg font-medium text-gray-600">No Case Processed Yet</div>
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
                      <span>Risk Score: <span className="font-bold text-gray-900">{result.risk_score ?? "-"}</span> / 10</span>
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
                            className={`px-3 py-2 rounded-lg text-xs ${getPatternBadgeStyle(p.code)}`}
                          >
                            {p.name}
                          </span>
                        ))
                      ) : (
                        <div className="text-sm text-gray-500 italic">No patterns detected</div>
                      )}
                    </div>
                  </div>

                  {/* Transactions */}
                  <TransactionTable transactions={result.transactions} />

                  {/* SAR Narrative */}
                  <div>
                    <div className="text-sm font-semibold text-gray-700 mb-3">SAR Narrative (Draft)</div>
                    <div className="border-2 border-gray-200 rounded-lg p-4 bg-gray-50 max-h-60 overflow-auto text-sm whitespace-pre-wrap font-mono">
                      {result.sar_text || "No narrative generated"}
                    </div>

                    <div className="flex gap-3 mt-4">
                      <Button
                        onClick={() => navigator.clipboard.writeText(result.sar_text || "")}
                        className="flex-1 bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50"
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        Copy Narrative
                      </Button>

                      <Button
                        onClick={() => {
                          if (!jobId) return;
                          window.open(`${backendUrl}/api/download/${jobId}`, "_blank");
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