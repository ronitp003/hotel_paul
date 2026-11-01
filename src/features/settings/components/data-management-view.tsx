"use client";

import React, { useState, useRef } from "react";
import { toast } from "sonner";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SelectDropdown } from "@/components/ui/select-dropdown";
import {
  DatabaseIcon,
  DownloadIcon,
  UploadIcon,
  FileSpreadsheetIcon,
  FileJsonIcon,
  ShieldAlertIcon,
  CircleCheckIcon,
  CircleAlertIcon,
  OctagonAlertIcon,
  SpinnerIcon,
  CheckIcon,
  CloseIcon,
  RefreshIcon,
} from "@/lib/icons";
import type { BackupDiffSummary, ConflictItem } from "@/features/settings/data-schemas";

type ExportRange = "all" | "7d" | "30d" | "month" | "lastMonth" | "currentFY" | "custom";
type ExportStatus = "ALL" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED";

export function DataManagementView() {
  // ── Export JSON State ───────────────────────────────────────────
  const [isExportingJson, setIsExportingJson] = useState(false);

  // ── Export CSV State ────────────────────────────────────────────
  const [csvRange, setCsvRange] = useState<ExportRange>("30d");
  const [csvStatus, setCsvStatus] = useState<ExportStatus>("ALL");
  const [csvFrom, setCsvFrom] = useState<string>("");
  const [csvTo, setCsvTo] = useState<string>("");
  const [isExportingCsv, setIsExportingCsv] = useState(false);

  // ── Restore / Import State ──────────────────────────────────────
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedBackupData, setParsedBackupData] = useState<unknown | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [diffSummary, setDiffSummary] = useState<BackupDiffSummary | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const [confirmCheckbox, setConfirmCheckbox] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState<{
    message: string;
    restoredCounts: Record<string, number>;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Handlers: Full JSON Backup ─────────────────────────────────
  const handleDownloadJsonBackup = async () => {
    try {
      setIsExportingJson(true);
      const res = await fetch("/api/export/backup-json", {
        method: "GET",
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(errorJson.error || `Download failed with status ${res.status}`);
      }

      const contentDisposition = res.headers.get("Content-Disposition");
      let filename = "hotel-paul-backup.json";
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      toast.success("Full system backup downloaded successfully.", {
        description: `Saved as ${filename}`,
      });
    } catch (err: unknown) {
      console.error("Backup export error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to generate backup JSON");
    } finally {
      setIsExportingJson(false);
    }
  };

  // ── Handlers: Accountant CSV Export ────────────────────────────
  const handleExportCsv = async () => {
    try {
      setIsExportingCsv(true);

      const params = new URLSearchParams();
      params.set("range", csvRange);
      params.set("status", csvStatus);

      if (csvRange === "custom") {
        if (!csvFrom || !csvTo) {
          toast.error("Please specify both Start Date and End Date for custom export.");
          setIsExportingCsv(false);
          return;
        }
        params.set("from", csvFrom);
        params.set("to", csvTo);
      }

      const res = await fetch(`/api/export/bookings-csv?${params.toString()}`, {
        method: "GET",
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(errorJson.error || `Export failed with status ${res.status}`);
      }

      const contentDisposition = res.headers.get("Content-Disposition");
      let filename = "hotel-paul-accountant-bookings.csv";
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      toast.success("Accountant CSV generated successfully.", {
        description: `Saved as ${filename}`,
      });
    } catch (err: unknown) {
      console.error("CSV export error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to export bookings CSV");
    } finally {
      setIsExportingCsv(false);
    }
  };

  // ── Handlers: File Selection & Dry-Run ──────────────────────────
  const handleFileChange = async (file: File) => {
    setSelectedFile(file);
    setParseError(null);
    setDiffSummary(null);
    setRestoreSuccess(null);
    setConfirmCheckbox(false);

    try {
      setIsAnalyzing(true);
      const text = await file.text();
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error("Invalid file format. The selected file is not valid JSON.");
      }

      setParsedBackupData(json);

      // Call dry-run endpoint
      const res = await fetch("/api/backup/dry-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      });

      const responseData = await res.json();
      if (!res.ok || !responseData.ok) {
        throw new Error(responseData.error || "Failed to analyze backup file.");
      }

      setDiffSummary(responseData.data as BackupDiffSummary);
      if (responseData.data.canProceed) {
        toast.success("Dry-run analysis passed! No blocking conflicts detected.");
      } else {
        toast.warning(
          `Analysis found ${responseData.data.conflicts.length} conflict(s). Review below.`
        );
      }
    } catch (err: unknown) {
      console.error("Dry run analysis error:", err);
      const message = err instanceof Error ? err.message : "Failed to analyze backup.";
      setParseError(message);
      toast.error(message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const resetRestoreState = () => {
    setSelectedFile(null);
    setParsedBackupData(null);
    setDiffSummary(null);
    setParseError(null);
    setConfirmCheckbox(false);
    setRestoreSuccess(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Handlers: Execute Restore ──────────────────────────────────
  const handleExecuteRestore = async () => {
    if (!parsedBackupData) return;
    if (!confirmCheckbox) {
      toast.error("Please check the confirmation box before executing restore.");
      return;
    }

    try {
      setIsRestoring(true);
      const res = await fetch("/api/backup/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          backupData: parsedBackupData,
          confirmed: true,
        }),
      });

      const responseData = await res.json();
      if (!res.ok || !responseData.ok) {
        throw new Error(responseData.error || "Database restore failed.");
      }

      setRestoreSuccess({
        message: responseData.data.message || "Database restored successfully.",
        restoredCounts: responseData.data.imported || responseData.data.restoredCounts || {},
      });

      toast.success("Database restored successfully!", {
        description: "All new records have been atomically merged into the live database.",
      });
    } catch (err: unknown) {
      console.error("Restore execution error:", err);
      toast.error(err instanceof Error ? err.message : "Restore execution failed.");
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* ── Page Header / Sub-banner ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl border border-border bg-card shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <DatabaseIcon className="size-5 text-primary" />
              Data Management, Backups & Exports
            </h2>
            <Badge variant="outline" className="text-[11px] font-semibold border-primary/30 text-primary">
              Owner Controls
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground max-w-2xl">
            Export full system JSON snapshots for disaster recovery, generate 32-column accountant GSTR billing reports, or safely restore from a previous backup with automatic conflict detection.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── CARD 1: Full System JSON Backup ── */}
        <Card className="flex flex-col justify-between border-border bg-card shadow-xs hover:border-border/80 transition-all">
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <FileJsonIcon className="size-5" />
              </div>
              <Badge variant="secondary" className="text-[11px] font-medium">
                schemaVersion: 1
              </Badge>
            </div>
            <CardTitle className="text-base font-semibold text-foreground">
              Full System JSON Backup
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground leading-relaxed">
              Export an encrypted, complete snapshot of hotel settings, room inventory, guest profiles, stays, payments, invoices, maintenance, and audit trails.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-2 text-xs p-3 rounded-lg border border-border/60 bg-muted/30">
              <div>
                <span className="text-muted-foreground block text-[11px]">Format</span>
                <span className="font-medium text-foreground">Standard JSON (UTF-8)</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Audit Trail</span>
                <span className="font-medium text-foreground">data.backup Logged</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Includes Stays</span>
                <span className="font-medium text-foreground">All Bookings & Guests</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Financial Data</span>
                <span className="font-medium text-foreground">Invoices & Payments</span>
              </div>
            </div>

            <Button
              type="button"
              onClick={handleDownloadJsonBackup}
              disabled={isExportingJson}
              className="w-full gap-2 cursor-pointer"
            >
              {isExportingJson ? (
                <>
                  <SpinnerIcon className="size-4 animate-spin" />
                  Generating JSON Backup...
                </>
              ) : (
                <>
                  <DownloadIcon className="size-4" />
                  Download Full System Backup (.json)
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* ── CARD 2: Accountant / GST Bookings CSV ── */}
        <Card className="flex flex-col justify-between border-border bg-card shadow-xs hover:border-border/80 transition-all">
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="size-10 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <FileSpreadsheetIcon className="size-5" />
              </div>
              <Badge variant="outline" className="text-[11px] font-medium border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                UTF-8 BOM (Excel Ready)
              </Badge>
            </div>
            <CardTitle className="text-base font-semibold text-foreground">
              Accountant & GST Bookings Export
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground leading-relaxed">
              32-column spreadsheet configured for CA filing (GSTR-1 / 3B). Itemizes room tariff, extra charges, CGST, SGST, advance, settlements, and net collections.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3.5 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Reporting Period
                </label>
                <SelectDropdown<ExportRange>
                  value={csvRange}
                  onChange={setCsvRange}
                  size="sm"
                  options={[
                    { value: "7d", label: "Last 7 Days" },
                    { value: "30d", label: "Last 30 Days" },
                    { value: "month", label: "This Month" },
                    { value: "lastMonth", label: "Last Month" },
                    { value: "currentFY", label: "Current FY (2026-27)" },
                    { value: "all", label: "All Stays (Full History)" },
                    { value: "custom", label: "Custom Date Range..." },
                  ]}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Stay Status Filter
                </label>
                <SelectDropdown<ExportStatus>
                  value={csvStatus}
                  onChange={setCsvStatus}
                  size="sm"
                  options={[
                    { value: "ALL", label: "All Stays" },
                    { value: "CHECKED_OUT", label: "Checked-out (Billed)" },
                    { value: "CHECKED_IN", label: "In-House Only" },
                    { value: "CANCELLED", label: "Cancelled Stays" },
                  ]}
                />
              </div>
            </div>

            {csvRange === "custom" && (
              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg border border-border/70 bg-muted/20 animate-in fade-in duration-200">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground">From Date</label>
                  <input
                    type="date"
                    value={csvFrom}
                    onChange={(e) => setCsvFrom(e.target.value)}
                    className="w-full text-xs h-8 px-2.5 rounded-md border border-input bg-background text-foreground"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground">To Date</label>
                  <input
                    type="date"
                    value={csvTo}
                    onChange={(e) => setCsvTo(e.target.value)}
                    className="w-full text-xs h-8 px-2.5 rounded-md border border-input bg-background text-foreground"
                  />
                </div>
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={handleExportCsv}
              disabled={isExportingCsv}
              className="w-full gap-2 cursor-pointer border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400"
            >
              {isExportingCsv ? (
                <>
                  <SpinnerIcon className="size-4 animate-spin text-emerald-600" />
                  Generating Accountant CSV...
                </>
              ) : (
                <>
                  <FileSpreadsheetIcon className="size-4 text-emerald-600 dark:text-emerald-400" />
                  Export Accountant CSV (.csv)
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ── SECTION 3: Interactive Restore & Conflict Dry-Run Engine ── */}
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="space-y-2 border-b border-border pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <UploadIcon className="size-5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-foreground">
                  Restore & Import Database (Conflict-Guarded)
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Upload a JSON system backup. The dry-run engine checks compatibility and warns of room overlaps before anything is written.
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[11px] border-amber-500/30 text-amber-600 dark:text-amber-400 gap-1">
                <ShieldAlertIcon className="size-3" />
                Dry-Run Enforced
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-5">
          {/* File Selection Dropzone */}
          {!selectedFile && !restoreSuccess && (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFileChange(e.dataTransfer.files[0]);
                }
              }}
              className="border-2 border-dashed border-border/80 hover:border-primary/50 hover:bg-primary/5 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all space-y-3 group"
            >
              <div className="size-12 rounded-full bg-muted/60 group-hover:bg-primary/10 text-muted-foreground group-hover:text-primary flex items-center justify-center transition-colors">
                <UploadIcon className="size-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  Click to browse or drag and drop a backup file
                </p>
                <p className="text-xs text-muted-foreground">
                  Supported file format: <span className="font-mono text-foreground">hotel-paul-backup-v1-*.json</span>
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileChange(e.target.files[0]);
                  }
                }}
              />
            </div>
          )}

          {/* Analyzing Spinner */}
          {isAnalyzing && (
            <div className="p-8 rounded-xl border border-border bg-muted/20 flex flex-col items-center justify-center space-y-3 text-center">
              <SpinnerIcon className="size-8 animate-spin text-primary" />
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-foreground">
                  Running non-destructive dry-run conflict analysis...
                </p>
                <p className="text-xs text-muted-foreground">
                  Checking schema integrity, matching duplicates, and verifying room stay calendars.
                </p>
              </div>
            </div>
          )}

          {/* Parse or Schema Error */}
          {parseError && (
            <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive flex items-start gap-3">
              <OctagonAlertIcon className="size-5 shrink-0 mt-0.5" />
              <div className="space-y-1 flex-1">
                <p className="text-sm font-semibold">Backup File Incompatible</p>
                <p className="text-xs opacity-90">{parseError}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={resetRestoreState}
                  className="mt-2 text-xs border-destructive/30 hover:bg-destructive/20 text-destructive cursor-pointer"
                >
                  <RefreshIcon className="size-3.5 mr-1" />
                  Select a Different File
                </Button>
              </div>
            </div>
          )}

          {/* Restore Success Screen */}
          {restoreSuccess && (
            <div className="p-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 space-y-4">
              <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
                <CircleCheckIcon className="size-6 shrink-0" />
                <div>
                  <h3 className="text-base font-semibold">Database Restore Succeeded!</h3>
                  <p className="text-xs opacity-90">{restoreSuccess.message}</p>
                </div>
              </div>

              {Object.keys(restoreSuccess.restoredCounts).length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2">
                  {Object.entries(restoreSuccess.restoredCounts).map(([entity, count]) => (
                    <div key={entity} className="p-2.5 rounded-lg border border-emerald-500/20 bg-background/50 text-center">
                      <span className="text-[11px] text-muted-foreground capitalize block">{entity}</span>
                      <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">+{count}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-2 flex gap-3">
                <Button
                  type="button"
                  size="sm"
                  onClick={resetRestoreState}
                  className="text-xs cursor-pointer"
                >
                  Done
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => window.location.reload()}
                  className="text-xs cursor-pointer gap-1.5"
                >
                  <RefreshIcon className="size-3.5" />
                  Refresh System Data
                </Button>
              </div>
            </div>
          )}

          {/* Dry-Run Analysis Results */}
          {diffSummary && !restoreSuccess && (
            <div className="space-y-6">
              {/* File Info Bar */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/40 text-xs">
                <div className="flex items-center gap-2.5 truncate">
                  <FileJsonIcon className="size-4 text-primary shrink-0" />
                  <span className="font-medium text-foreground truncate">
                    {selectedFile?.name}
                  </span>
                  <span className="text-muted-foreground text-[11px]">
                    ({((selectedFile?.size || 0) / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetRestoreState}
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer gap-1"
                >
                  <CloseIcon className="size-3.5" />
                  Clear File
                </Button>
              </div>

              {/* Status Banner */}
              {diffSummary.canProceed ? (
                <div className="p-3.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 flex items-center gap-2.5 text-xs font-medium">
                  <CircleCheckIcon className="size-4 shrink-0 text-emerald-600" />
                  <span>
                    Dry-run check verified: No blocking conflicts or room overlaps detected. Safe to import.
                  </span>
                </div>
              ) : (
                <div className="p-3.5 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive flex items-center gap-2.5 text-xs font-semibold">
                  <OctagonAlertIcon className="size-4 shrink-0" />
                  <span>
                    Restore is blocked: {diffSummary.conflicts.length} conflict(s) detected. Overlapping stays or duplicate invoice collisions must be resolved.
                  </span>
                </div>
              )}

              {/* Diff Counts Breakdown */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Record Diff Analysis
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {[
                    { label: "Rooms", diff: diffSummary.diffs.rooms },
                    { label: "Bookings & Stays", diff: diffSummary.diffs.bookings },
                    { label: "Invoices", diff: diffSummary.diffs.invoices },
                    { label: "Payments", diff: diffSummary.diffs.payments },
                    { label: "Inventory", diff: diffSummary.diffs.inventoryItems },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="p-3 rounded-lg border border-border bg-card space-y-1.5"
                    >
                      <span className="text-[11px] font-medium text-muted-foreground block truncate">
                        {item.label}
                      </span>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                          +{item.diff.new}
                        </span>
                        <span className="text-[11px] text-muted-foreground">new</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {item.diff.existing} identical (skip)
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Conflicts List */}
              {diffSummary.conflicts.length > 0 && (
                <div className="space-y-2.5">
                  <h4 className="text-xs font-semibold text-destructive uppercase tracking-wider flex items-center gap-1.5">
                    <CircleAlertIcon className="size-4" />
                    Conflict Details ({diffSummary.conflicts.length})
                  </h4>
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                    {diffSummary.conflicts.map((conflict: ConflictItem, index: number) => (
                      <div
                        key={index}
                        className="p-3 rounded-lg border border-destructive/30 bg-destructive/5 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between font-semibold text-destructive">
                          <span className="font-mono uppercase">{conflict.type}</span>
                          <span className="text-[11px] opacity-80">{conflict.severity}</span>
                        </div>
                        <p className="text-foreground/90 font-medium">{conflict.description}</p>
                        {conflict.reference && (
                          <div className="text-[11px] text-muted-foreground font-mono pt-0.5">
                            Reference: {conflict.reference} (Entity: {conflict.entityId})
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Restore Confirmation Gate */}
              {diffSummary.canProceed && (
                <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-4">
                  <div className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      id="confirm-restore"
                      checked={confirmCheckbox}
                      onChange={(e) => setConfirmCheckbox(e.target.checked)}
                      className="mt-0.5 rounded border-input size-4 text-primary focus:ring-primary cursor-pointer"
                    />
                    <label
                      htmlFor="confirm-restore"
                      className="text-xs text-foreground cursor-pointer select-none leading-relaxed"
                    >
                      I have verified the record diff counts above and confirm that I want to merge these records into the live database. (Transaction is protected: rolls back automatically on error; logged to audit trail).
                    </label>
                  </div>

                  <Button
                    type="button"
                    onClick={handleExecuteRestore}
                    disabled={!confirmCheckbox || isRestoring}
                    className="w-full gap-2 cursor-pointer bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                  >
                    {isRestoring ? (
                      <>
                        <SpinnerIcon className="size-4 animate-spin" />
                        Executing Database Restore...
                      </>
                    ) : (
                      <>
                        <CheckIcon className="size-4" />
                        Confirm & Execute Restore
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
