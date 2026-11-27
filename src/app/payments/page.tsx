"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

type Invoice = {
  id: string;
  invoice_number: string;
  invoice_date: string;
  customer_id: string | null;
  customer_name: string;
  total_amount: number;
};

type Payment = {
  id: string;
  payment_number: string;
  payment_date: string;
  amount: number;
  payment_mode: string;
  reference_number: string | null;
  notes: string | null;
  customer_id: string;
};

type Allocation = {
  invoice_id: string;
  amount: number;
};

const money = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n || 0);

export default function PaymentsPage() {
  const supabase = createClient();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("upi");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    const { data: invoiceData, error: invoiceError } = await supabase
      .from("invoices")
      .select("id, invoice_number, invoice_date, customer_id, customer_name, total_amount")
      .order("created_at", { ascending: false });

    if (invoiceError) {
      setError(invoiceError.message);
      setLoading(false);
      return;
    }

    const { data: paymentData, error: paymentError } = await supabase
      .from("customer_payments")
      .select("id, payment_number, payment_date, amount, payment_mode, reference_number, notes, customer_id")
      .order("created_at", { ascending: false });

    const { data: allocationData, error: allocationError } = await supabase
      .from("payment_allocations")
      .select("invoice_id, amount");

    if (paymentError || allocationError) {
      setError(paymentError?.message || allocationError?.message || "Could not load payment records.");
      setLoading(false);
      return;
    }

    setInvoices((invoiceData || []) as Invoice[]);
    setPayments((paymentData || []) as Payment[]);
    setAllocations((allocationData || []) as Allocation[]);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const paidByInvoice = useMemo(() => {
    const result: Record<string, number> = {};
    allocations.forEach((a) => {
      result[a.invoice_id] = (result[a.invoice_id] || 0) + Number(a.amount);
    });
    return result;
  }, [allocations]);

  const outstandingInvoices = invoices
    .map((invoice) => ({
      ...invoice,
      paid: paidByInvoice[invoice.id] || 0,
      outstanding: Math.max(0, Number(invoice.total_amount) - (paidByInvoice[invoice.id] || 0)),
    }))
    .filter((invoice) => invoice.outstanding > 0);

  const totalInvoiced = invoices.reduce((sum, i) => sum + Number(i.total_amount), 0);
  const totalCollected = allocations.reduce((sum, a) => sum + Number(a.amount), 0);
  const totalOutstanding = outstandingInvoices.reduce((sum, i) => sum + i.outstanding, 0);

  async function recordPayment(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    const selected = outstandingInvoices.find((i) => i.id === invoiceId);
    const value = Number(amount);

    if (!selected) {
      setError("Select an invoice with an outstanding balance.");
      setSaving(false);
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter a valid payment amount.");
      setSaving(false);
      return;
    }
    if (value > selected.outstanding) {
      setError(`Payment exceeds outstanding balance of ${money(selected.outstanding)}.`);
      setSaving(false);
      return;
    }

    const { data, error: rpcError } = await supabase.rpc("record_customer_payment", {
      p_invoice_id: invoiceId,
      p_amount: value,
      p_payment_mode: mode,
      p_reference_number: reference || null,
      p_notes: notes || null,
    });

    if (rpcError) {
      setError(rpcError.message);
    } else {
      const result = Array.isArray(data) ? data[0] : data;
      setMessage(`Payment ${result?.payment_number || ""} recorded successfully. Remaining invoice balance: ${money(Number(result?.outstanding_amount || 0))}`);
      setAmount("");
      setReference("");
      setNotes("");
      setInvoiceId("");
      await loadData();
    }
    setSaving(false);
  }

  return (
    <main className="min-h-screen bg-[#080d18] px-5 py-8 text-white md:px-10">
      <div className="mx-auto max-w-7xl space-y-7">
        <Link href="/dashboard" className="text-blue-400 hover:text-blue-300">← Back to dashboard</Link>

        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-blue-300">Finance operations</p>
            <h1 className="mt-1 text-3xl font-bold">Payments & Receivables</h1>
            <p className="mt-2 text-slate-400">Record customer collections and track invoice-wise outstanding balances.</p>
          </div>
          <button onClick={loadData} className="rounded-xl bg-slate-800 px-5 py-3 hover:bg-slate-700">↻ Refresh</button>
        </header>

        {message && <div className="rounded-xl border border-green-700 bg-green-950/40 p-4 text-green-300">{message}</div>}
        {error && <div className="rounded-xl border border-red-700 bg-red-950/40 p-4 text-red-300">{error}</div>}

        <section className="grid gap-4 md:grid-cols-3">
          {[
            ["Total invoiced", money(totalInvoiced)],
            ["Total collected", money(totalCollected)],
            ["Outstanding receivables", money(totalOutstanding)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-slate-800 bg-[#121b2d] p-6">
              <p className="text-sm text-slate-400">{label}</p>
              <p className="mt-2 text-2xl font-bold">{loading ? "…" : value}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <form onSubmit={recordPayment} className="space-y-4 rounded-2xl border border-slate-800 bg-[#121b2d] p-6">
            <h2 className="text-xl font-semibold">Record customer payment</h2>

            <label className="block text-sm text-slate-300">Invoice</label>
            <select required value={invoiceId} onChange={(e) => {
              setInvoiceId(e.target.value);
              const selected = outstandingInvoices.find((i) => i.id === e.target.value);
              setAmount(selected ? String(selected.outstanding.toFixed(2)) : "");
            }} className="w-full rounded-lg border border-slate-700 bg-[#080d18] p-3">
              <option value="">Select outstanding invoice</option>
              {outstandingInvoices.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.invoice_number} — {i.customer_name} — Due {money(i.outstanding)}
                </option>
              ))}
            </select>

            {invoiceId && (
              <p className="text-sm text-amber-300">
                Balance due: {money(outstandingInvoices.find((i) => i.id === invoiceId)?.outstanding || 0)}
              </p>
            )}

            <label className="block text-sm text-slate-300">Payment amount (₹)</label>
            <input required type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-[#080d18] p-3" placeholder="Enter amount" />

            <label className="block text-sm text-slate-300">Payment mode</label>
            <select value={mode} onChange={(e) => setMode(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-[#080d18] p-3">
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="cheque">Cheque</option>
            </select>

            <label className="block text-sm text-slate-300">Transaction / cheque reference</label>
            <input value={reference} onChange={(e) => setReference(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-[#080d18] p-3" placeholder="Optional reference number" />

            <label className="block text-sm text-slate-300">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-[#080d18] p-3" rows={3} placeholder="Optional notes" />

            <button disabled={saving || loading || outstandingInvoices.length === 0} className="w-full rounded-xl bg-blue-600 p-3 font-semibold hover:bg-blue-500 disabled:opacity-50">
              {saving ? "Recording payment..." : "Record payment"}
            </button>
            {outstandingInvoices.length === 0 && <p className="text-sm text-slate-400">No outstanding invoices available.</p>}
          </form>

          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#121b2d]">
            <div className="border-b border-slate-800 p-5">
              <h2 className="text-xl font-semibold">Outstanding invoices</h2>
              <p className="mt-1 text-sm text-slate-400">Invoice balances update after each payment.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900/70 text-slate-400">
                  <tr><th className="p-4">Invoice / Customer</th><th className="p-4">Total</th><th className="p-4">Paid</th><th className="p-4">Due</th></tr>
                </thead>
                <tbody>
                  {outstandingInvoices.map((i) => (
                    <tr key={i.id} className="border-t border-slate-800">
                      <td className="p-4"><div className="font-medium">{i.invoice_number}</div><div className="text-slate-400">{i.customer_name}</div></td>
                      <td className="p-4 whitespace-nowrap">{money(Number(i.total_amount))}</td>
                      <td className="p-4 whitespace-nowrap text-green-300">{money(i.paid)}</td>
                      <td className="p-4 whitespace-nowrap text-amber-300">{money(i.outstanding)}</td>
                    </tr>
                  ))}
                  {!loading && outstandingInvoices.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-slate-400">No outstanding invoices.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-[#121b2d]">
          <div className="border-b border-slate-800 p-5">
            <h2 className="text-xl font-semibold">Payment history</h2>
            <p className="mt-1 text-sm text-slate-400">Latest customer collections</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900/70 text-slate-400">
                <tr><th className="p-4">Payment number</th><th className="p-4">Date</th><th className="p-4">Mode</th><th className="p-4">Reference</th><th className="p-4">Amount</th></tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-t border-slate-800">
                    <td className="p-4 font-medium">{p.payment_number}</td>
                    <td className="p-4">{p.payment_date}</td>
                    <td className="p-4 capitalize">{p.payment_mode.replace("_", " ")}</td>
                    <td className="p-4 text-slate-400">{p.reference_number || "—"}</td>
                    <td className="p-4 font-semibold text-green-300">{money(Number(p.amount))}</td>
                  </tr>
                ))}
                {!loading && payments.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-400">No payments recorded yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
