import { AdminLayout } from "@/components/layout/AdminLayout";
import { getAuthHeaders } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useState, useRef } from "react";
import {
  Download, Upload, FileSpreadsheet, Database,
  HardDrive, AlertTriangle, CheckCircle2, Loader2
} from "lucide-react";
import { useImportBackup, getExportBackupUrl, getExportOrdersCsvUrl } from "@workspace/api-client-react";

export default function AdminBackup() {
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<Record<string, number> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const importMutation = useImportBackup({ request: { headers: getAuthHeaders() } });

  const handleExportCSV = async () => {
    setExportingCsv(true);
    try {
      const res = await fetch(getExportOrdersCsvUrl(), {
        headers: { ...getAuthHeaders() },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `trynex-orders-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Orders exported!", description: "CSV file downloaded successfully." });
    } catch {
      toast({ title: "Export failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setExportingCsv(false);
    }
  };

  const handleExportBackup = async () => {
    setExporting(true);
    try {
      const res = await fetch(getExportBackupUrl(), {
        headers: { ...getAuthHeaders() },
      });
      if (!res.ok) throw new Error('Backup failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `trynex-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Backup exported!", description: "Full database backup downloaded." });
    } catch {
      toast({ title: "Backup failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed.version || !parsed.data) {
        toast({ title: "Invalid file", description: "This doesn't look like a TryNex backup file.", variant: "destructive" });
        return;
      }
      const result = await importMutation.mutateAsync({
        data: { version: parsed.version, data: parsed.data },
      });
      setImportResult(result.imported);
      toast({ title: "Backup restored!", description: "Data imported successfully." });
    } catch {
      toast({ title: "Import failed", description: "Check the file format and try again.", variant: "destructive" });
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-3xl">
        <div className="mb-8">
          <h1 className="text-2xl font-black font-display tracking-tight text-gray-900">Backup & Export</h1>
          <p className="text-sm text-gray-500 mt-1">Export your data or restore from a previous backup.</p>
        </div>

        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#eff6ff' }}>
                <FileSpreadsheet className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Export Orders (CSV)</h3>
                <p className="text-xs text-gray-500">Download all orders as a spreadsheet. Opens in Excel, Google Sheets, etc.</p>
              </div>
            </div>
            <button
              onClick={handleExportCSV}
              disabled={exportingCsv}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white transition-all hover:-translate-y-0.5 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #2563eb, #3b82f6)', boxShadow: '0 4px 12px rgba(37,99,235,0.3)' }}
            >
              {exportingCsv ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {exportingCsv ? "Exporting..." : "Download CSV"}
            </button>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#f0fdf4' }}>
                <Database className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Full Database Backup</h3>
                <p className="text-xs text-gray-500">Export everything — orders, products, categories, settings, blog posts as JSON.</p>
              </div>
            </div>
            <button
              onClick={handleExportBackup}
              disabled={exporting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white transition-all hover:-translate-y-0.5 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #16a34a, #22c55e)', boxShadow: '0 4px 12px rgba(22,163,74,0.3)' }}
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardDrive className="w-4 h-4" />}
              {exporting ? "Creating backup..." : "Export Full Backup"}
            </button>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#fff7ed' }}>
                <Upload className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Restore from Backup</h3>
                <p className="text-xs text-gray-500">Import a previously exported TryNex backup file (.json).</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl mb-4" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <p className="text-xs text-amber-700 font-medium">Existing data will not be deleted. Duplicate entries will be skipped.</p>
            </div>

            <button
              onClick={() => fileRef.current?.click()}
              disabled={importing}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5 disabled:opacity-50"
              style={{ background: '#fff8f5', border: '1px solid #fed7aa', color: '#E85D04' }}
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {importing ? "Importing..." : "Choose Backup File"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />

            {importResult && (
              <div className="mt-4 p-4 rounded-xl" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span className="font-bold text-sm text-green-700">Import Complete</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {Object.entries(importResult).map(([key, count]) => (
                    <div key={key} className="flex justify-between px-3 py-1.5 rounded-lg bg-white">
                      <span className="capitalize text-gray-600">{key}</span>
                      <span className="font-bold text-green-700">{count} records</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
