"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

type Tx = {
  Date?: string;
  amount?: string;
  Type?: string;
  Details?: string;
  [key: string]: any;
};

type Pattern = {
  code: string;
  name: string;
  description: string;
  matches: any[];
};

type JobResult = {
  transactions: Tx[];
  patterns: Pattern[];
  risk_score: number;
  risk_band: string;
  final_recommendation: string;
  sar_text: string;
};

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [result, setResult] = useState<JobResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Poll backend status
  useEffect(() => {
    if (!jobId) return;
    if (status === "done" || status === "error") return;

    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`${API_BASE}/api/status/${jobId}`);
        const data = await res.json();

        if (cancelled) return;

        if (data.error) {
          setStatus("error");
          setError(data.error);
          return;
        }

        if (data.status === "done") {
          setStatus("done");
          const res2 = await fetch(`${API_BASE}/api/result/${jobId}`);
          const resultData = await res2.json();
          setResult(resultData as JobResult);
          return;
        } else if (data.status === "error") {
          setStatus("error");
          setError(data.error || "Backend error");
          return;
        } else {
          setStatus(data.status);
          setTimeout(poll, 1500);
        }
      } catch (e: any) {
        if (cancelled) return;
        setStatus("error");
        setError(e.message || "Network error");
      }
    }

    poll();
    return () => {
      cancelled = true;
    };
  }, [jobId, status]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setJobId(null);
    setStatus(null);
    setResult(null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Select a file first.");
      return;
    }

    setIsUploading(true);
    setError(null);
    setJobId(null);
    setStatus("uploading");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_BASE}/api/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Upload failed: ${res.status} ${text}`);
      }

      const data = await res.json();
      if (!data.job_id) {
        throw new Error("No job_id returned from backend");
      }

      setJobId(data.job_id);
      setStatus("queued");
    } catch (err: any) {
      setStatus("error");
      setError(err.message || "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const resetAll = () => {
    setFile(null);
    setJobId(null);
    setStatus(null);
    setResult(null);
    setError(null);
  };

  const downloadUrl = jobId
    ? `${API_BASE}/api/download/${jobId}`
    : undefined;

  const renderRiskBadge = (band: string) => {
    const b = band?.toLowerCase();
    if (b === "high")
      return <Badge className="bg-red-600 text-white hover:bg-red-600/90">High</Badge>;
    if (b === "medium")
      return (
        <Badge className="bg-yellow-500 text-white hover:bg-yellow-500/90">
          Medium
        </Badge>
      );
    return (
      <Badge className="bg-emerald-600 text-white hover:bg-emerald-600/90">
        Low
      </Badge>
    );
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="max-w-7xl mx-auto py-8 px-4 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-50">
              AML Case Processor
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Upload transaction files, detect AML patterns, and generate a SAR
              narrative.
            </p>
          </div>
          {jobId && (
            <Button variant="outline" size="sm" onClick={resetAll} className="text-slate-50 border-slate-700 hover:bg-slate-800">
              New Case
            </Button>
          )}
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT: upload + risk + patterns */}
          <div className="space-y-4">
            <Card className="bg-slate-900/80 border-slate-800">
              <CardHeader>
                <CardTitle className="text-base text-slate-50">
                  Upload Case File (CSV / XLSX / PDF)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Input
                      type="file"
                      accept=".csv,.xlsx,.xls,.pdf"
                      onChange={handleFileChange}
                      className="cursor-pointer bg-slate-950 border-slate-700 text-slate-50 file:text-slate-50"
                    />
                    {file && (
                      <p className="text-xs text-slate-400">
                        Selected:{" "}
                        <span className="font-mono text-slate-300">{file.name}</span>
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="submit" disabled={!file || isUploading} className="bg-blue-600 hover:bg-blue-700 text-white">
                      {isUploading ? "Uploading..." : "Process Case"}
                    </Button>
                    {status && status !== "error" && (
                      <span className="text-xs text-slate-400">
                        Status:{" "}
                        <span className="font-mono text-slate-200">
                          {status.toUpperCase()}
                        </span>
                      </span>
                    )}
                  </div>
                </form>

                {error && (
                  <div className="mt-4">
                    <Alert variant="destructive">
                      <AlertTitle className="text-red-50">Error</AlertTitle>
                      <AlertDescription className="text-xs text-red-100">
                        {error}
                      </AlertDescription>
                    </Alert>
                  </div>
                )}
              </CardContent>
            </Card>

            {result && (
              <Card className="bg-slate-900/80 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-base text-slate-50">
                    Risk Summary & Decision
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2 items-center">
                    <Badge variant="outline" className="font-mono text-slate-50 border-slate-600">
                      Score: {result.risk_score}
                    </Badge>
                    {renderRiskBadge(result.risk_band)}
                    <Badge variant="outline" className="text-slate-50 border-slate-600">
                      Recommendation:{" "}
                      <span className="ml-1 font-semibold">
                        {result.final_recommendation}
                      </span>
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-400">
                    Risk band and recommendation come from the rule engine and
                    risk scoring logic (not from the LLM).
                  </p>
                </CardContent>
              </Card>
            )}

            {result && (
              <Card className="bg-slate-900/80 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-base text-slate-50">
                    Detected Patterns
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(!result.patterns || result.patterns.length === 0) && (
                    <p className="text-sm text-slate-400">
                      No suspicious patterns detected for this case.
                    </p>
                  )}

                  {result.patterns?.length > 0 && (
                    <div className="space-y-2">
                      {result.patterns.map((p) => (
                        <div
                          key={p.code}
                          className="rounded-lg border border-slate-700 bg-slate-800/80 p-3 space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <div className="text-sm font-semibold text-slate-50">
                                {p.name}
                              </div>
                              <div className="text-[11px] text-sky-400 font-mono">
                                {p.code}
                              </div>
                            </div>
                            <Badge
                              variant="outline"
                              className="text-[11px] border-slate-500 text-slate-200"
                            >
                              Matches: {p.matches?.length ?? 0}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-300">
                            {p.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* RIGHT: narrative + transactions */}
          <div className="space-y-4">
            {result && (
              <Card className="bg-slate-900/80 border-slate-800">
                <CardHeader className="flex flex-row items-center justify-between gap-3">
                  <CardTitle className="text-base text-slate-50">SAR Narrative</CardTitle>
                  {downloadUrl && (
                    <Button asChild size="sm" variant="outline" className="text-slate-800 border-slate-700 hover:bg-slate-800">
                      <a href={downloadUrl} target="_blank" rel="noreferrer">
                        Download PDF
                      </a>
                    </Button>
                  )}
                </CardHeader>
                <Separator className="bg-slate-800" />
                <CardContent className="pt-4">
                  <ScrollArea className=" rounded-md border border-slate-800 bg-slate-950/70 p-4">
                    <pre className="text-xs leading-relaxed whitespace-pre-wrap font-mono text-slate-200">
                      {result.sar_text}
                    </pre>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}

            {result && (
              <Card className="bg-slate-900/80 border-slate-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-slate-50">
                    Transactions (sample)
                  </CardTitle>
                  <p className="text-xs text-slate-400 mt-1">
                    Showing up to {result.transactions?.length ?? 0} rows
                    (backend caps at 50).
                  </p>
                </CardHeader>
                <Separator className="bg-slate-800" />
                <CardContent className="pt-4">
                  <div className="rounded-md border border-slate-800 overflow-hidden">
                    <ScrollArea className="h-[350px]">
                      <Table>
                        <TableHeader className="sticky top-0 bg-slate-950/95 z-10">
                          <TableRow className="border-slate-800 hover:bg-slate-900/50">
                            <TableHead className="text-xs text-slate-300 font-semibold whitespace-nowrap">Date</TableHead>
                            <TableHead className="text-xs text-slate-300 font-semibold whitespace-nowrap">Amount</TableHead>
                            <TableHead className="text-xs text-slate-300 font-semibold whitespace-nowrap">Type</TableHead>
                            <TableHead className="text-xs text-slate-300 font-semibold">Details</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {result.transactions?.length ? (
                            result.transactions.map((tx, idx) => (
                              <TableRow key={idx} className="text-xs border-slate-800 hover:bg-slate-800/50">
                                <TableCell className="text-slate-200 whitespace-nowrap">{tx.Date}</TableCell>
                                <TableCell className="text-slate-200 whitespace-nowrap">{tx.amount}</TableCell>
                                <TableCell className="text-slate-200 whitespace-nowrap">{tx.Type}</TableCell>
                                <TableCell className="text-slate-200">{tx.Details}</TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow className="border-slate-800">
                              <TableCell
                                colSpan={4}
                                className="text-center text-xs text-slate-400 py-8"
                              >
                                No transactions returned.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}