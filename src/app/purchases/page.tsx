"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { RefreshCw, Plus, Trash2, ShoppingCart } from "lucide-react";

type Supplier = { id: string; name: string };
type Item = { id: string; name: string; sku: string; item_type: string };
type Line = { item_id: string; quantity: string; unit_cost: string; gst_rate: string };
type Purchase = {
  id: string;
  purchase_number: string;
  purchase_date: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  suppliers?: { name: string } | null;
};

export default function PurchasesPage() {
  const supabase = createClient();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState("");
  useEffect(() => { setDate(new Date().toISOString().slice(0, 10)); }, []);
  const [lines, setLines] = useState<Line[]>([
    { item_id: "", quantity: "1", unit_cost: "0", gst_rate: "0" },
  ]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadData() {
    const [s, i, p] = await Promise.all([
      supabase.from("suppliers").select("id,name").order("name"),
      supabase.from("items").select("id,name,sku,item_type").eq("is_active", true)
        .in("item_type", ["raw_material", "packaging"]).order("name"),
      supabase.from("purchases")
        .select("id,purchase_number,purchase_date,subtotal,tax_amount,total_amount,suppliers(name)")
        .order("created_at", { ascending: false }).limit(50),
    ]);

    if (s.error) setError(s.error.message);
    if (i.error) setError(i.error.message);
    if (p.error) setError(p.error.message);

    setSuppliers((s.data || []) as Supplier[]);
    setItems((i.data || []) as Item[]);
    setPurchases((p.data || []) as unknown as Purchase[]);
  }

  useEffect(() => { loadData(); }, []);

  function updateLine(index: number, key: keyof Line, value: string) {
    setLines(old => old.map((line, i) =>
      i === index ? { ...line, [key]: value } : line
    ));
  }

  function addLine() {
    setLines(old => [...old, {
      item_id: "", quantity: "1", unit_cost: "0", gst_rate: "0",
    }]);
  }

  function removeLine(index: number) {
    setLines(old => old.filter((_, i) => i !== index));
  }

  const subtotal = lines.reduce((sum, l) =>
    sum + (Number(l.quantity) || 0) * (Number(l.unit_cost) || 0), 0);
  const tax = lines.reduce((sum, l) => {
    const amount = (Number(l.quantity) || 0) * (Number(l.unit_cost) || 0);
    return sum + amount * (Number(l.gst_rate) || 0) / 100;
  }, 0);

  async function postPurchase(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!supplierId) return setError("Select a supplier.");
    if (lines.length === 0 || lines.some(l =>
      !l.item_id || Number(l.quantity) <= 0 ||
      Number(l.unit_cost) < 0 || Number(l.gst_rate) < 0 ||
      Number(l.gst_rate) > 100
    )) return setError("Check all purchase item details.");

    setLoading(true);

    const { data, error: rpcError } = await supabase.rpc("post_purchase", {
      p_supplier_id: supplierId,
      p_purchase_date: date,
      p_supplier_invoice_number: invoiceNo || null,
      p_items: lines.map(l => ({
        item_id: l.item_id,
        quantity: Number(l.quantity),
        unit_cost: Number(l.unit_cost),
        gst_rate: Number(l.gst_rate),
      })),
      p_notes: notes || null,
    });

    if (rpcError) {
      setError(rpcError.message);
    } else {
      const result = Array.isArray(data) ? data[0] : data;
      setMessage(`Purchase ${result?.purchase_number || ""} posted successfully. Stock updated.`);
      setSupplierId("");
      setInvoiceNo("");
      setNotes("");
      setLines([{ item_id: "", quantity: "1", unit_cost: "0", gst_rate: "0" }]);
      await loadData();
    }
    setLoading(false);
  }

  const money = (n: number) =>
    "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

  return (
    <main className="min-h-screen bg-[#080d18] text-white p-5 md:p-10">
      <div className="max-w-7xl mx-auto space-y-7">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Link href="/dashboard" className="text-blue-400 hover:underline">← Back to dashboard</Link>
            <p className="text-sm text-blue-300 mt-3">Factory operations</p>
            <h1 className="text-3xl font-bold mt-1">Purchases & Suppliers</h1>
            <p className="text-slate-400 mt-2">Record material purchases and automatically update stock.</p>
          </div>
          <button onClick={loadData} className="bg-slate-800 rounded-xl px-4 py-3 flex gap-2 items-center">
            <RefreshCw size={17}/> Refresh
          </button>
        </div>

        {message && <div className="p-4 rounded-xl border border-green-700 bg-green-950 text-green-300">{message}</div>}
        {error && <div className="p-4 rounded-xl border border-red-700 bg-red-950 text-red-300">{error}</div>}

        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-[#141d30] border border-slate-800 rounded-2xl p-5">
            <p className="text-slate-400">Purchase records</p>
            <h2 className="text-3xl font-bold mt-2">{purchases.length}</h2>
          </div>
          <div className="bg-[#141d30] border border-slate-800 rounded-2xl p-5">
            <p className="text-slate-400">Registered suppliers</p>
            <h2 className="text-3xl font-bold mt-2">{suppliers.length}</h2>
          </div>
          <div className="bg-[#141d30] border border-slate-800 rounded-2xl p-5">
            <p className="text-slate-400">Purchases recorded</p>
            <h2 className="text-3xl font-bold mt-2">{money(purchases.reduce((s,p) => s + Number(p.total_amount), 0))}</h2>
          </div>
        </div>

        <form onSubmit={postPurchase} className="bg-[#141d30] border border-slate-800 rounded-2xl p-5 md:p-7 space-y-6">
          <h2 className="text-xl font-bold flex items-center gap-2"><ShoppingCart/> Record new purchase</h2>

          <div className="grid md:grid-cols-3 gap-4">
            <label className="text-sm text-slate-300">Supplier
              <select value={supplierId} onChange={e => setSupplierId(e.target.value)} required className="mt-2 w-full bg-[#080d18] border border-slate-700 rounded-lg p-3 text-white">
                <option value="">Select supplier</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label className="text-sm text-slate-300">Purchase date
              <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="mt-2 w-full bg-[#080d18] border border-slate-700 rounded-lg p-3 text-white"/>
            </label>
            <label className="text-sm text-slate-300">Supplier invoice number
              <input value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} placeholder="Optional invoice number" className="mt-2 w-full bg-[#080d18] border border-slate-700 rounded-lg p-3 text-white"/>
            </label>
          </div>

          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Purchase items</h3>
            <button type="button" onClick={addLine} className="text-blue-400 flex items-center gap-1"><Plus size={17}/> Add item</button>
          </div>

          {lines.map((line, index) => (
            <div key={index} className="grid md:grid-cols-5 gap-3 bg-[#0b1221] rounded-xl p-4">
              <label className="text-xs text-slate-400 md:col-span-2">Material
                <select value={line.item_id} onChange={e => updateLine(index, "item_id", e.target.value)} required className="mt-2 w-full bg-[#141d30] border border-slate-700 rounded-lg p-3 text-white">
                  <option value="">Select material</option>
                  {items.map(item => <option key={item.id} value={item.id}>{item.name} ({item.sku})</option>)}
                </select>
              </label>
              <label className="text-xs text-slate-400">Quantity
                <input type="number" min="0.001" step="0.001" value={line.quantity} onChange={e => updateLine(index, "quantity", e.target.value)} required className="mt-2 w-full bg-[#141d30] border border-slate-700 rounded-lg p-3 text-white"/>
              </label>
              <label className="text-xs text-slate-400">Unit cost (₹)
                <input type="number" min="0" step="0.01" value={line.unit_cost} onChange={e => updateLine(index, "unit_cost", e.target.value)} required className="mt-2 w-full bg-[#141d30] border border-slate-700 rounded-lg p-3 text-white"/>
              </label>
              <div className="flex gap-2 items-end">
                <label className="text-xs text-slate-400 flex-1">GST %
                  <input type="number" min="0" max="100" step="0.01" value={line.gst_rate} onChange={e => updateLine(index, "gst_rate", e.target.value)} className="mt-2 w-full bg-[#141d30] border border-slate-700 rounded-lg p-3 text-white"/>
                </label>
                <button type="button" disabled={lines.length === 1} onClick={() => removeLine(index)} className="p-3 text-red-400 disabled:opacity-30"><Trash2 size={18}/></button>
              </div>
            </div>
          ))}

          <label className="block text-sm text-slate-300">Notes
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Purchase or delivery notes" className="mt-2 w-full bg-[#080d18] border border-slate-700 rounded-lg p-3 text-white"/>
          </label>

          <div className="ml-auto max-w-sm space-y-2 text-sm">
            <div className="flex justify-between text-slate-300"><span>Subtotal</span><span>{money(subtotal)}</span></div>
            <div className="flex justify-between text-slate-300"><span>Tax</span><span>{money(tax)}</span></div>
            <div className="flex justify-between text-xl font-bold border-t border-slate-700 pt-3"><span>Total</span><span>{money(subtotal + tax)}</span></div>
          </div>

          <button disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl p-4 font-bold">
            {loading ? "Posting purchase..." : "Post purchase & update stock"}
          </button>
        </form>

        <section className="bg-[#141d30] border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-slate-800"><h2 className="text-xl font-bold">Purchase history</h2></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-slate-400 bg-[#0b1221]">
                <tr><th className="p-4">Purchase number</th><th className="p-4">Supplier</th><th className="p-4">Date</th><th className="p-4">Subtotal</th><th className="p-4">Tax</th><th className="p-4">Total</th></tr>
              </thead>
              <tbody>
                {purchases.map(p => <tr key={p.id} className="border-t border-slate-800">
                  <td className="p-4 font-medium">{p.purchase_number}</td>
                  <td className="p-4">{p.suppliers?.name || "Supplier"}</td>
                  <td className="p-4">{p.purchase_date}</td>
                  <td className="p-4">{money(p.subtotal)}</td>
                  <td className="p-4">{money(p.tax_amount)}</td>
                  <td className="p-4 font-semibold">{money(p.total_amount)}</td>
                </tr>)}
                {purchases.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-400">No purchases recorded yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}


