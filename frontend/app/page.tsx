"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressText, setProgressText] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [inlineLoading, setInlineLoading] = useState(false);

  // fallback chain so undefined envs won't break UI
  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://localhost:8000";

  async function processCase() {
    if (!file) return;
    setIsProcessing(true);
    setInlineLoading(true);
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

      const { job_id } = await uploadRes.json();
      setJobId(job_id);
      setProgressText("Analyzing case… this usually takes a few seconds");

      // poll status endpoint
      let done = false;
      while (!done) {
        await new Promise((r) => setTimeout(r, 1200));

        const statusRes = await fetch(`${backendUrl}/api/status/${job_id}`);
        if (!statusRes.ok) throw new Error("Status fetch failed");

        const statusJson = await statusRes.json();

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

      // fetch final result
      const resultRes = await fetch(`${backendUrl}/api/result/${job_id}`);
      if (!resultRes.ok) throw new Error("Result fetch failed");
      const resultJson = await resultRes.json();
      setResult(resultJson);
    } catch (err: any) {
      console.error(err);
      alert(err?.message || "Processing error");
    } finally {
      setIsProcessing(false);
      setInlineLoading(false);
      setProgressText("");
    }
  }

  function getRiskColor(band: string) {
    if (!band) return "bg-gray-200 text-gray-800";
    const b = band.toLowerCase();
    if (b === "high") return "bg-red-600 text-white";
    if (b === "medium") return "bg-yellow-400 text-black";
    return "bg-green-600 text-white";
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-6">
      {/* HERO */}
      <div className="max-w-4xl mx-auto text-center mb-8">
        <h1 className="text-4xl font-bold">AML Case Processor</h1>
        <p className="text-gray-700 mt-3 max-w-2xl mx-auto">
          Upload a transaction file and instantly generate AML red flags,
          risk scoring, and a SAR-ready narrative.
        </p>
        <p className="text-sm text-gray-500 mt-2">Supports CSV, XLSX, PDF.</p>
      </div>

      <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* UPLOAD PANEL */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle>1. Upload Case File</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select a transaction export (CSV/XLSX) or case PDF
              </label>
              <Input
                type="file"
                accept=".csv,.xlsx,.xls,.pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <p className="text-xs text-gray-500">
              No data is stored. Files are processed in memory only.
            </p>

            <div className="flex gap-3 items-center">
              <Button
                onClick={processCase}
                disabled={!file || isProcessing}
                className="flex-1"
              >
                {inlineLoading ? "Analyzing case…" : "Process Case"}
              </Button>

              <Button
                variant="ghost"
                onClick={() => {
                  setFile(null);
                  setResult(null);
                }}
              >
                Reset
              </Button>
            </div>

            {isProcessing && (
              <div className="text-xs text-gray-600 mt-2">{progressText}</div>
            )}

            <div className="mt-2 text-xs text-gray-400">
              Data Privacy: Uploaded files are processed for analysis and are not
              stored or used to train models.
            </div>
          </CardContent>
        </Card>

        {/* RESULTS CARD (always visible) */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle>Case Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!result ? (
              <div className="text-sm text-gray-600">
                No case processed yet. Upload a file and click “Process Case” to
                see results.
              </div>
            ) : (
              <>
                {/* Summary */}
                <div className="">
                 <div className="text-sm text-gray-500">Job: {jobId ?? "-"}</div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">  
                  <div className="flex items-center gap-3">
                    <div className={`px-3 py-1 rounded-full ${getRiskColor(result.risk_band)}`}>
                      {result.risk_band || "Unknown"}
                    </div>
                    <div className="text-xs text-gray-700">
                      Risk score: <span className="font-medium">{result.risk_score ?? "-"}</span> / 10
                    </div>
                    <div className="text-xs text-gray-700">
                      Recommendation: <span className="font-medium">{result.final_recommendation ?? "-"}</span>
                    </div>
                  </div>
                </div>

                {/* Patterns */}
                <div>
                  <div className="text-sm font-medium mb-2">Detected patterns:</div>
                  <div className="flex flex-wrap gap-2">
                    {result.patterns?.length ? (
                      result.patterns.map((p: any, i: number) => (
                        <div key={i} className="text-xs px-2 py-1 bg-gray-100 rounded">
                          {p.name}
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-gray-500">None detected</div>
                    )}
                  </div>
                </div>

                {/* Transactions (compact) */}
                <div>
                  <div className="text-sm font-medium mb-2">Transactions (sample)</div>
                  <div className="overflow-auto border rounded">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-left">
                          <th className="p-2">Date</th>
                          <th className="p-2">Amount</th>
                          <th className="p-2">Type</th>
                          <th className="p-2">Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.transactions?.slice(0, 10).map((t: any, idx: number) => (
                          <tr key={idx} className="border-t">
                            <td className="p-2 text-xs">{t.Date}</td>
                            <td className="p-2 text-xs">{t.amount}</td>
                            <td className="p-2 text-xs">{t.Type}</td>
                            <td className="p-2 text-xs">{t.Details}</td>
                          </tr>
                        )) ?? (
                          <tr>
                            <td colSpan={4} className="p-2 text-sm text-gray-500">
                              No transactions returned
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* SAR Narrative */}
                <div>
                  <div className="text-sm font-medium mb-2">SAR Narrative (Draft)</div>
                  <div className="border rounded p-2 bg-gray-50 max-h-40 overflow-auto text-sm whitespace-pre-wrap">
                    {result.sar_text || "No narrative returned"}
                  </div>

                  <div className="flex gap-2 mt-3">
                    <Button
                      onClick={() => navigator.clipboard.writeText(result.sar_text || "")}
                    >
                      Copy Narrative
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => {
                        if (!jobId) return;
                        window.open(`${backendUrl}/api/download/${jobId}`, "_blank");
                      }}
                    >
                      Download SAR PDF
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
