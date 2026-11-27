"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

type Issue = {
  level: "HIGH" | "MEDIUM" | "INFO";
  title: string;
  detail: string;
  action: string;
};

export default function AuditPage() {
  const supabase = createClient();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadAudit() {
    setLoading(true);
    const found: Issue[] = [];

    const [itemsRes, runsRes, ordersRes] = await Promise.all([
      supabase.from("items").select("id,name,item_type,reorder_level"),
      supabase.from("production_runs").select(
        "run_number,planned_output,actual_output,yield_variance,total_production_cost,cost_per_unit,status"
      ).order("created_at", { ascending: false }).limit(100),
      supabase.from("sales_orders").select(
        "id,order_number,status,total_amount"
      ).eq("status", "approved")
    ]);

    if (itemsRes.error || runsRes.error || ordersRes.error) {
      found.push({
        level: "HIGH",
        title: "Audit data could not be fully loaded",
        detail: itemsRes.error?.message || runsRes.error?.message || ordersRes.error?.message || "Check database access.",
        action: "Check Supabase connection and permissions."
      });
    }

    const items = itemsRes.data || [];
    const runs = runsRes.data || [];

    if (items.length) {
      const ids = items.map((i) => i.id);
      const { data: movements } = await supabase
        .from("stock_movements")
        .select("item_id,movement_type,quantity")
        .in("item_id", ids);

      for (const item of items) {
        const balance = (movements || [])
          .filter((m) => m.item_id === item.id)
          .reduce((sum, m) => {
            const positive = [
              "opening", "purchase", "purchase_in", "production_output",
              "production_in", "sales_return", "adjustment", "adjustment_in"
            ];
            const negative = [
              "production_issue", "production_out", "sale_dispatch",
              "dispatch_out", "purchase_return", "adjustment_out"
            ];
            if (positive.includes(m.movement_type)) return sum + Number(m.quantity);
            if (negative.includes(m.movement_type)) return sum - Number(m.quantity);
            return sum;
          }, 0);

        if (balance <= Number(item.reorder_level || 0)) {
          found.push({
            level: "MEDIUM",
            title: `Low stock: ${item.name}`,
            detail: `Current balance: ${balance}. Reorder level: ${item.reorder_level || 0}.`,
            action: "Review replenishment before accepting new orders."
          });
        }
      }
    }

    for (const run of runs) {
      const planned = Number(run.planned_output || 0);
      const actual = Number(run.actual_output || 0);
      const loss = planned > 0 ? ((planned - actual) / planned) * 100 : 0;

      if (loss > 0) {
        found.push({
          level: loss >= 5 ? "HIGH" : "MEDIUM",
          title: `Production yield loss: ${run.run_number}`,
          detail: `${planned} planned, ${actual} actual. Yield loss: ${loss.toFixed(2)}%.`,
          action: "Review material consumption, damaged packaging and production notes."
        });
      }
    }

    for (const order of ordersRes.data || []) {
      const { data: invoice } = await supabase
        .from("invoices")
        .select("id")
        .eq("sales_order_id", order.id)
        .maybeSingle();

      if (!invoice) {
        found.push({
          level: "MEDIUM",
          title: `Approved order without invoice: ${order.order_number}`,
          detail: `Order value: ₹${Number(order.total_amount || 0).toFixed(2)}.`,
          action: "Generate and verify the invoice before dispatch."
        });
      }
    }

    if (!found.length) {
      found.push({
        level: "INFO",
        title: "No exceptions detected",
        detail: "No low-stock, production-yield or approved-order invoice exceptions were found in the records checked.",
        action: "Continue monitoring new transactions."
      });
    }

    setIssues(found);
    setLoading(false);
  }

  useEffect(() => { loadAudit(); }, []);

  const high = issues.filter((i) => i.level === "HIGH").length;
  const medium = issues.filter((i) => i.level === "MEDIUM").length;

  return (
    <main className="min-h-screen bg-[#080d18] px-5 py-8 text-white md:px-10">
      <div className="mx-auto max-w-7xl space-y-7">
        <Link href="/dashboard" className="text-blue-400">← Back to dashboard</Link>
        <header className="flex flex-wrap justify-between gap-4">
          <div>
            <p className="text-sm text-blue-300">Intelligence & compliance</p>
            <h1 className="mt-1 text-3xl font-bold">AuditIQ Exception Centre</h1>
            <p className="mt-2 text-slate-400">Operational exceptions with source context and recommended actions.</p>
          </div>
          <button onClick={loadAudit} className="rounded-xl bg-slate-800 px-5 py-3">↻ Refresh audit</button>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-[#121b2d] p-6">
            <p className="text-slate-400">Total exceptions</p>
            <p className="mt-2 text-3xl font-bold">{loading ? "…" : issues.length}</p>
          </div>
          <div className="rounded-2xl border border-red-900 bg-[#121b2d] p-6">
            <p className="text-slate-400">High priority</p>
            <p className="mt-2 text-3xl font-bold text-red-400">{loading ? "…" : high}</p>
          </div>
          <div className="rounded-2xl border border-amber-900 bg-[#121b2d] p-6">
            <p className="text-slate-400">Needs review</p>
            <p className="mt-2 text-3xl font-bold text-amber-400">{loading ? "…" : medium}</p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-[#121b2d]">
          <div className="border-b border-slate-800 p-5">
            <h2 className="text-xl font-semibold">Detected exceptions</h2>
            <p className="mt-1 text-sm text-slate-400">Refresh after posting a transaction to update findings.</p>
          </div>
          <div className="divide-y divide-slate-800">
            {loading ? <p className="p-6 text-slate-400">Scanning operational records…</p> :
              issues.map((issue, index) => (
                <article key={index} className="space-y-2 p-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                      issue.level === "HIGH" ? "bg-red-950 text-red-300" :
                      issue.level === "MEDIUM" ? "bg-amber-950 text-amber-300" :
                      "bg-emerald-950 text-emerald-300"
                    }`}>{issue.level}</span>
                    <h3 className="font-semibold">{issue.title}</h3>
                  </div>
                  <p className="text-sm text-slate-300">{issue.detail}</p>
                  <p className="text-sm text-blue-300">Suggested action: {issue.action}</p>
                </article>
              ))
            }
          </div>
        </section>

        <p className="text-xs leading-5 text-slate-500">
          AuditIQ currently performs read-only operational checks. Findings are decision-support alerts, not statutory audit opinions or proof of regulatory compliance.
        </p>
      </div>
    </main>
  );
}
