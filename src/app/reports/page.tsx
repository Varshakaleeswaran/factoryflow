"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

type ReportRow = Record<string, string | number | null>;

export default function ReportsPage() {
  const supabase = createClient();
  const [sales, setSales] = useState<ReportRow[]>([]);
  const [stock, setStock] = useState<ReportRow[]>([]);
  const [production, setProduction] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadReports() {
    setLoading(true);
    setError("");

    const [salesResult, stockResult, productionResult] = await Promise.all([
      supabase.from("invoices").select(
        "invoice_number, invoice_date, customer_name, subtotal, tax_amount, total_amount"
      ).order("created_at", { ascending: false }),
      supabase.from("stock_movements").select(
        "created_at, item_id, movement_type, quantity, unit_cost, notes"
      ).order("created_at", { ascending: false }).limit(500),
      supabase.from("production_runs").select(
        "run_number, created_at, planned_output, actual_output, yield_variance, total_production_cost, cost_per_unit, status"
      ).order("created_at", { ascending: false })
    ]);

    const firstError = salesResult.error || stockResult.error || productionResult.error;
    if (firstError) setError(firstError.message);

    const movements = stockResult.data || [];
    const itemIds = [...new Set(movements.map((m) => m.item_id).filter(Boolean))];

    let itemNames: Record<string, string> = {};
    if (itemIds.length) {
      const { data } = await supabase.from("items").select("id, name").in("id", itemIds);
      (data || []).forEach((item) => { itemNames[item.id] = item.name; });
    }

    setSales((salesResult.data || []) as ReportRow[]);
    setStock(movements.map((m) => ({
      date: m.created_at,
      item: itemNames[m.item_id] || m.item_id,
      movement: m.movement_type,
      quantity: m.quantity,
      unit_cost: m.unit_cost,
      notes: m.notes
    })));
    setProduction((productionResult.data || []) as ReportRow[]);
    setLoading(false);
  }

  useEffect(() => { loadReports(); }, []);

  function downloadCSV(filename: string, rows: ReportRow[]) {
    if (!rows.length) {
      setError("No records available for this report yet.");
      return;
    }
    const headers = Object.keys(rows[0]);
    const escape = (value: unknown) =>
      '"' + String(value ?? "").replace(/"/g, '""') + '"';
    const csv = [
      headers.map(escape).join(","),
      ...rows.map((row) => headers.map((h) => escape(row[h])).join(","))
    ].join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const money = (value: unknown) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency", currency: "INR", maximumFractionDigits: 2
    }).format(Number(value || 0));

  const totalSales = sales.reduce((sum, row) => sum + Number(row.total_amount || 0), 0);
  const totalProduction = production.reduce(
    (sum, row) => sum + Number(row.actual_output || 0), 0
  );

  const reports = [
    { title: "Sales Register", description: "Invoice-wise sales, taxable value and tax.", rows: sales, file: "factoryflow-sales-register.csv" },
    { title: "Stock Movement Ledger", description: "Item-wise inward and outward stock transactions.", rows: stock, file: "factoryflow-stock-ledger.csv" },
    { title: "Production Report", description: "Planned output, actual output, yield variance and cost.", rows: production, file: "factoryflow-production-report.csv" }
  ];

  return (
    <main className="min-h-screen bg-[#080d18] px-5 py-8 text-white md:px-10">
      <div className="mx-auto max-w-7xl space-y-7">
        <Link href="/dashboard" className="text-blue-400 hover:text-blue-300">← Back to dashboard</Link>

        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-blue-300">Business intelligence</p>
            <h1 className="mt-1 text-3xl font-bold">Reports & Exports</h1>
            <p className="mt-2 text-slate-400">Download operational records for management and audit.</p>
          </div>
          <button onClick={loadReports} className="rounded-xl bg-slate-800 px-5 py-3 hover:bg-slate-700">↻ Refresh</button>
        </header>

        {error && <div className="rounded-xl border border-red-700 bg-red-950/40 p-4 text-red-300">{error}</div>}

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-[#121b2d] p-6">
            <p className="text-sm text-slate-400">Invoiced sales</p>
            <p className="mt-2 text-2xl font-bold">{loading ? "…" : money(totalSales)}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-[#121b2d] p-6">
            <p className="text-sm text-slate-400">Production runs</p>
            <p className="mt-2 text-2xl font-bold">{loading ? "…" : production.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-[#121b2d] p-6">
            <p className="text-sm text-slate-400">Finished units produced</p>
            <p className="mt-2 text-2xl font-bold">{loading ? "…" : totalProduction.toLocaleString("en-IN")}</p>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-3">
          {reports.map((report) => (
            <article key={report.title} className="rounded-2xl border border-slate-800 bg-[#121b2d] p-6">
              <div className="text-3xl">📊</div>
              <h2 className="mt-4 text-xl font-semibold">{report.title}</h2>
              <p className="mt-2 min-h-12 text-sm text-slate-400">{report.description}</p>
              <p className="mt-4 text-sm text-slate-300">{loading ? "Loading…" : `${report.rows.length} records`}</p>
              <button
                disabled={loading || report.rows.length === 0}
                onClick={() => downloadCSV(report.file, report.rows)}
                className="mt-5 w-full rounded-xl bg-blue-600 p-3 font-semibold hover:bg-blue-500 disabled:opacity-40"
              >
                ↓ Download CSV
              </button>
            </article>
          ))}
        </section>

        <section className="rounded-2xl border border-slate-800 bg-[#121b2d] p-6">
          <h2 className="text-xl font-semibold">Audit-ready data exports</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            These exports use records currently available in FactoryFlow. They are operational reports,
            not certified statutory accounting or GST returns. Verify financial and tax records with an accountant.
          </p>
        </section>
      </div>
    </main>
  );
}
