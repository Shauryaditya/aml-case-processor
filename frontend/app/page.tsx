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

  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

  const processCase = async () => {
    if (!file) return;

    try {
      setIsProcessing(true);
      setProgressText("Uploading file...");

      const formData = new FormData();
      formData.append("file", file);

      // 1) Upload
      const uploadRes = await fetch(`${backendUrl}/api/upload`, {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        throw new Error(`Upload failed: ${uploadRes.status}`);
      }

      const { job_id } = await uploadRes.json();
      setJobId(job_id);

      // 2) Poll status
      setProgressText("Analyzing case… detecting AML patterns");

      let done = false;
      while (!done) {
        await new Promise((r) => setTimeout(r, 1500));

        const statusRes = await fetch(`${backendUrl}/api/status/${job_id}`);
        const statusJson = await statusRes.json();

        if (statusJson.error) {
          throw new Error(statusJson.error);
        }

        const st = statusJson.status;

        if (st === "done") {
          done = true;
          break;
        }

        if (st === "error") {
          throw new Error(statusJson.error || "Backend error");
        }

        // live backend job status
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

      // 3) Fetch final result
      const resultRes = await fetch(`${backendUrl}/api/result/${job_id}`);
      if (!resultRes.ok) {
        throw new Error(`Result fetch failed: ${resultRes.status}`);
      }
      const resultJson = await resultRes.json();
      setResult(resultJson);
    } catch (err) {
      console.error(err);
      alert("Error processing case");
    } finally {
      setIsProcessing(false);
    }
  };

  function getRiskColor(band: string) {
    if (band === "High") return "bg-red-500";
    if (band === "Medium") return "bg-yellow-500";
    return "bg-green-500";
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 p-6">
      {/* HEADER */}
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold">AML Case Processor</h1>
        <p className="text-gray-600 mt-2">
          Upload a case file, detect AML patterns, and generate a
          regulator-ready SAR narrative in seconds.
        </p>
        <p className="text-sm text-gray-500 mt-1">Supports CSV, XLSX, PDF.</p>
      </div>

      {/* Loader overlay */}
      {isProcessing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[999]">
          <div className="bg-white rounded-md p-6 shadow-xl w-[320px] text-center">
            <div className="animate-spin h-8 w-8 border-4 border-gray-300 border-t-blue-600 rounded-full mx-auto mb-4"></div>
            <p className="text-sm text-gray-700">{progressText}</p>
          </div>
        </div>
      )}

      {/* UPLOAD PANEL */}
      <Card className="max-w-xl mx-auto mb-10">
        <CardHeader>
          <CardTitle>1. Upload Case File</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />

          <p className="text-xs text-gray-500">
            No data is stored. Files are processed in memory only.
          </p>

          <Button
            disabled={!file || isProcessing}
            onClick={processCase}
            className="w-full"
          >
            {isProcessing ? "Processing..." : "Process Case"}
          </Button>
        </CardContent>
      </Card>

      {/* RESULTS PANEL */}
      {result && (
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle>Case Summary</CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* SUMMARY ROW */}
            <div className="flex flex-wrap items-center gap-4">
              <Badge className={getRiskColor(result.risk_band)}>
                {result.risk_band}
              </Badge>
              <span>Risk Score: {result.risk_score} / 10</span>
              <span>Recommendation: {result.final_recommendation}</span>
            </div>

            {/* PATTERNS */}
            <div>
              <h2 className="font-semibold mb-2">Detected Patterns</h2>
              <div className="flex flex-wrap gap-2">
                {result.patterns?.map((p: any, i: number) => (
                  <Badge key={i} variant="outline">
                    {p.name}
                  </Badge>
                ))}
              </div>
            </div>

            {/* TRANSACTIONS TABLE */}
            <div>
              <h2 className="font-semibold mb-2">Transactions (first 10)</h2>
              <div className="overflow-x-auto border rounded">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100 text-left">
                      <th className="p-2">Date</th>
                      <th className="p-2">Amount</th>
                      <th className="p-2">Type</th>
                      <th className="p-2">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.transactions
                      ?.slice(0, 10)
                      .map((t: any, i: number) => (
                        <tr key={i} className="border-t">
                          <td className="p-2">{t.Date}</td>
                          <td className="p-2">${t.amount}</td>
                          <td className="p-2">{t.Type}</td>
                          <td className="p-2">{t.Details}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* SAR NARRATIVE */}
            <div>
              <h2 className="font-semibold mb-2">SAR Narrative (Draft)</h2>
              <div className="border rounded p-3 bg-gray-50 max-h-64 overflow-auto text-sm whitespace-pre-wrap">
                {result.sar_text}
              </div>

              <div className="flex gap-3 mt-3">
                <Button
                  onClick={() => navigator.clipboard.writeText(result.sar_text)}
                >
                  Copy Narrative
                </Button>

                <Button
                  variant="outline"
                  onClick={() => {
                    if (!jobId) return;
                    window.open(
                      `${backendUrl}/api/download/${jobId}`,
                      "_blank"
                    );
                  }}
                >
                  Download PDF
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* FOOTER */}
      <p className="text-center text-xs text-gray-500 mt-10">
        Data is processed in memory only. Files are not stored.
      </p>
    </div>
  );
}
