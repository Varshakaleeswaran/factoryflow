"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

type Item = { id: string; sku: string; name: string; item_type: string; unit_id: string };
type Unit = { id: string; symbol: string };
type Bom = { id: string; name: string; version: number; expected_output: number; finished_item_id: string; is_active: boolean };
type BomLine = { id: string; bom_id: string; item_id: string; quantity_per_batch: number };
type Run = { id: string; run_number: string; planned_output: number; actual_output: number; yield_variance: number; total_material_cost: number; additional_cost: number; total_production_cost: number; cost_per_unit: number; created_at: string; status: string };
type ComponentDraft = { item_id: string; quantity: string };

export default function ProductionPage() {
  const supabase = createClient();
  const [items, setItems] = useState<Item[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [boms, setBoms] = useState<Bom[]>([]);
  const [bomLines, setBomLines] = useState<BomLine[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedBom, setSelectedBom] = useState("");
  const [plannedOutput, setPlannedOutput] = useState("200");
  const [actualOutput, setActualOutput] = useState("188");
  const [additionalCost, setAdditionalCost] = useState("1800");
  const [actuals, setActuals] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [bomName, setBomName] = useState("Murukku 200g - Standard BOM");
  const [bomFinishedItem, setBomFinishedItem] = useState("");
  const [bomExpectedOutput, setBomExpectedOutput] = useState("200");
  const [components, setComponents] = useState<ComponentDraft[]>([{ item_id: "", quantity: "40" }]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingBom, setSavingBom] = useState(false);
  const [posting, setPosting] = useState(false);

  async function loadData() {
    setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setMessage("Please sign in."); setLoading(false); return; }
    const { data: member, error: memberError } = await supabase.from("organization_members")
      .select("organization_id").eq("user_id", auth.user.id).eq("is_active", true).limit(1).maybeSingle();
    if (memberError || !member) { setMessage("Active organization membership not found."); setLoading(false); return; }
    const orgId = member.organization_id;
    const [itemRes, unitRes, bomRes, lineRes, runRes] = await Promise.all([
      supabase.from("items").select("id,sku,name,item_type,unit_id").eq("organization_id", orgId).eq("is_active", true).order("name"),
      supabase.from("units").select("id,symbol").eq("organization_id", orgId),
      supabase.from("boms").select("id,name,version,expected_output,finished_item_id,is_active").eq("organization_id", orgId).order("created_at", { ascending: false }),
      supabase.from("bom_items").select("id,bom_id,item_id,quantity_per_batch"),
      supabase.from("production_runs").select("id,run_number,planned_output,actual_output,yield_variance,total_material_cost,additional_cost,total_production_cost,cost_per_unit,created_at,status").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(30)
    ]);
    const err = itemRes.error || unitRes.error || bomRes.error || lineRes.error || runRes.error;
    if (err) setMessage(err.message);
    setItems(itemRes.data || []); setUnits(unitRes.data || []); setBoms(bomRes.data || []);
    setBomLines(lineRes.data || []); setRuns(runRes.data || []);
    const activeBoms = (bomRes.data || []).filter((b: Bom) => b.is_active);
    if (activeBoms.length && !activeBoms.some((b: Bom) => b.id === selectedBom)) setSelectedBom(activeBoms[0].id);
    const finished = (itemRes.data || []).find((i: Item) => i.item_type === "finished_good");
    if (finished && !bomFinishedItem) setBomFinishedItem(finished.id);
    setLoading(false);
  }

  useEffect(() => { void loadData(); }, []);

  const currentBom = boms.find(b => b.id === selectedBom && b.is_active);
  const currentLines = useMemo(() => bomLines.filter(line => line.bom_id === selectedBom), [bomLines, selectedBom]);
  const rawItems = items.filter(i => i.item_type === "raw_material" || i.item_type === "packaging");
  const finishedItems = items.filter(i => i.item_type === "finished_good");
  const unitFor = (itemId: string) => units.find(u => u.id === items.find(i => i.id === itemId)?.unit_id)?.symbol || "units";
  const itemName = (itemId: string) => items.find(i => i.id === itemId)?.name || "Unknown item";
  const planned = Number(plannedOutput) || 0;
  const expectedBase = Number(currentBom?.expected_output || 0);

  function setComponent(index: number, key: keyof ComponentDraft, value: string) {
    setComponents(old => old.map((c, i) => i === index ? { ...c, [key]: value } : c));
  }

  async function createBom(e: React.FormEvent) {
    e.preventDefault(); setMessage("");
    if (!bomFinishedItem || !bomName.trim() || Number(bomExpectedOutput) <= 0 || !components.length || components.some(c => !c.item_id || Number(c.quantity) <= 0)) {
      setMessage("Complete the BOM name, finished product, output and every component quantity."); return;
    }
    if (new Set(components.map(c => c.item_id)).size !== components.length) { setMessage("Each material can appear only once in a BOM."); return; }
    setSavingBom(true);
    const { data: auth } = await supabase.auth.getUser();
    const { data: member } = await supabase.from("organization_members").select("organization_id").eq("user_id", auth.user?.id || "").eq("is_active", true).limit(1).maybeSingle();
    if (!member) { setMessage("Organization membership not found."); setSavingBom(false); return; }
    const nextVersion = Math.max(0, ...boms.filter(b => b.finished_item_id === bomFinishedItem).map(b => b.version)) + 1;
    const { data: bom, error } = await supabase.from("boms").insert({ organization_id: member.organization_id, finished_item_id: bomFinishedItem, version: nextVersion, name: bomName.trim(), expected_output: Number(bomExpectedOutput), is_active: true }).select("id").single();
    if (error || !bom) { setMessage("Could not create BOM: " + (error?.message || "Unknown error")); setSavingBom(false); return; }
    const { error: lineError } = await supabase.from("bom_items").insert(components.map(c => ({ bom_id: bom.id, item_id: c.item_id, quantity_per_batch: Number(c.quantity) })));
    if (lineError) {
      await supabase.from("boms").delete().eq("id", bom.id);
      setMessage("BOM components were not saved: " + lineError.message);
    } else {
      setMessage("BOM created successfully."); setBomName(""); setComponents([{ item_id: "", quantity: "" }]); await loadData(); setSelectedBom(bom.id);
    }
    setSavingBom(false);
  }

  async function postRun(e: React.FormEvent) {
    e.preventDefault(); setMessage("");
    if (!currentBom || !currentLines.length) { setMessage("Select a BOM that has components."); return; }
    if (planned <= 0 || Number(actualOutput) <= 0 || Number(additionalCost) < 0) { setMessage("Enter valid production quantities and additional cost."); return; }
    const consumption = currentLines.map(line => ({ item_id: line.item_id, actual_quantity: Number(actuals[line.item_id] ?? (Number(line.quantity_per_batch) * planned / expectedBase).toFixed(3)) }));
    if (consumption.some(c => !Number.isFinite(c.actual_quantity) || c.actual_quantity <= 0)) { setMessage("Every actual consumption quantity must be greater than zero."); return; }
    setPosting(true);
    const { data, error } = await supabase.rpc("post_production_run", {
      p_bom_id: selectedBom, p_planned_output: planned, p_actual_output: Number(actualOutput),
      p_consumptions: consumption, p_additional_cost: Number(additionalCost), p_notes: notes.trim() || null
    });
    if (error) setMessage("Production posting failed: " + error.message);
    else {
      const result = Array.isArray(data) ? data[0] : data;
      setMessage(`Production posted: ${result?.run_number || "Run created"}. Total cost ₹${Number(result?.total_cost || 0).toFixed(2)}; cost per unit ₹${Number(result?.cost_per_unit || 0).toFixed(2)}.`);
      setNotes(""); await loadData();
    }
    setPosting(false);
  }

  return (
    <main className="min-h-screen bg-[#080d19] p-6 text-white md:p-10">
      <Link href="/dashboard" className="text-sm text-blue-400">← Back to dashboard</Link>
      <header className="mt-7"><p className="text-sm text-slate-400">Factory operations</p><h1 className="mt-2 text-3xl font-bold">Production Management</h1><p className="mt-2 text-sm text-slate-400">BOM control, material consumption, finished output and production costing.</p></header>
      {message && <div className="mt-6 rounded-lg border border-slate-700 bg-slate-900 p-4 text-sm">{message}</div>}
      {loading ? <p className="mt-8 text-slate-400">Loading production data...</p> : <>
        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-[#101a2c] p-5"><p className="text-sm text-slate-400">Active BOMs</p><p className="mt-2 text-3xl font-bold">{boms.filter(b => b.is_active).length}</p></div>
          <div className="rounded-xl border border-slate-800 bg-[#101a2c] p-5"><p className="text-sm text-slate-400">Production runs</p><p className="mt-2 text-3xl font-bold">{runs.filter(r => r.status === "posted").length}</p></div>
          <div className="rounded-xl border border-slate-800 bg-[#101a2c] p-5"><p className="text-sm text-slate-400">Finished units produced</p><p className="mt-2 text-3xl font-bold">{runs.filter(r => r.status === "posted").reduce((sum, r) => sum + Number(r.actual_output), 0).toLocaleString("en-IN")}</p></div>
        </section>
        <section className="mt-8 grid gap-6 xl:grid-cols-2">
          <form onSubmit={createBom} className="rounded-xl border border-slate-800 bg-[#101a2c] p-6">
            <h2 className="text-xl font-semibold">Create Bill of Materials</h2><p className="mt-1 text-sm text-slate-400">Define the standard material quantities for one production batch.</p>
            <label className="mt-5 block text-sm text-slate-300">BOM name<input required value={bomName} onChange={e => setBomName(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 p-3" /></label>
            <label className="mt-4 block text-sm text-slate-300">Finished product<select required value={bomFinishedItem} onChange={e => setBomFinishedItem(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 p-3">{finishedItems.map(i => <option key={i.id} value={i.id}>{i.name} ({i.sku})</option>)}</select></label>
            <label className="mt-4 block text-sm text-slate-300">Expected output (finished units)<input type="number" min="0.001" step="0.001" required value={bomExpectedOutput} onChange={e => setBomExpectedOutput(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 p-3" /></label>
            <div className="mt-5 flex items-center justify-between"><h3 className="font-medium">BOM components</h3><button type="button" onClick={() => setComponents(old => [...old, { item_id: "", quantity: "" }])} className="text-sm text-blue-400">+ Add component</button></div>
            {components.map((c, index) => <div key={index} className="mt-3 grid grid-cols-[1fr_110px_36px] gap-2"><select required value={c.item_id} onChange={e => setComponent(index, "item_id", e.target.value)} className="min-w-0 rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm"><option value="">Select material</option>{rawItems.map(i => <option key={i.id} value={i.id}>{i.name} ({i.sku})</option>)}</select><input required type="number" min="0.001" step="0.001" placeholder="Qty" value={c.quantity} onChange={e => setComponent(index, "quantity", e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm" /><button type="button" disabled={components.length === 1} onClick={() => setComponents(old => old.filter((_, i) => i !== index))} className="rounded-lg border border-slate-700 text-slate-400 disabled:opacity-30">×</button></div>)}
            <button disabled={savingBom || !finishedItems.length || !rawItems.length} className="mt-6 w-full rounded-lg bg-slate-700 px-5 py-3 font-semibold disabled:opacity-50">{savingBom ? "Saving BOM..." : "Create BOM"}</button>
          </form>
          <form onSubmit={postRun} className="rounded-xl border border-slate-800 bg-[#101a2c] p-6">
            <h2 className="text-xl font-semibold">Post production run</h2><p className="mt-1 text-sm text-slate-400">Actual stock is deducted and finished goods are added in one database transaction.</p>
            <label className="mt-5 block text-sm text-slate-300">Select BOM<select required value={selectedBom} onChange={e => { setSelectedBom(e.target.value); setActuals({}); }} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 p-3"><option value="">Select BOM</option>{boms.filter(b => b.is_active).map(b => <option key={b.id} value={b.id}>{b.name} · v{b.version} · {itemName(b.finished_item_id)}</option>)}</select></label>
            <div className="mt-4 grid grid-cols-2 gap-3"><label className="text-sm text-slate-300">Planned output<input type="number" min="0.001" step="0.001" required value={plannedOutput} onChange={e => setPlannedOutput(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 p-3" /></label><label className="text-sm text-slate-300">Actual good output<input type="number" min="0.001" step="0.001" required value={actualOutput} onChange={e => setActualOutput(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 p-3" /></label></div>
            {currentBom && currentLines.length > 0 && <div className="mt-5"><h3 className="font-medium">Actual material consumption</h3><p className="mt-1 text-xs text-slate-500">Defaults are scaled from the BOM for the planned output. Change them to record actual usage.</p>{currentLines.map(line => { const suggested = expectedBase > 0 ? Number(line.quantity_per_batch) * planned / expectedBase : 0; return <label key={line.id} className="mt-3 block text-sm text-slate-300">{itemName(line.item_id)} <span className="text-slate-500">(planned {suggested.toFixed(3)} {unitFor(line.item_id)})</span><input type="number" min="0.001" step="0.001" value={actuals[line.item_id] ?? suggested.toFixed(3)} onChange={e => setActuals(old => ({ ...old, [line.item_id]: e.target.value }))} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 p-3" /></label>; })}</div>}
            <label className="mt-4 block text-sm text-slate-300">Additional production cost (₹)<input type="number" min="0" step="0.01" value={additionalCost} onChange={e => setAdditionalCost(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 p-3" /></label>
            <label className="mt-4 block text-sm text-slate-300">Notes<textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 p-3" placeholder="Shift, batch or operator notes" /></label>
            {currentBom && <p className="mt-3 text-xs text-slate-500">Yield variance: {(Number(actualOutput) - planned).toFixed(3)} units ({planned > 0 ? (((Number(actualOutput) - planned) / planned) * 100).toFixed(2) : "0.00"}%)</p>}
            <button disabled={posting || !currentBom || !currentLines.length} className="mt-6 w-full rounded-lg bg-blue-600 px-5 py-3 font-semibold disabled:opacity-50">{posting ? "Posting transaction..." : "Post production run"}</button>
          </form>
        </section>
        <section className="mt-8 overflow-x-auto rounded-xl border border-slate-800 bg-[#101a2c]"><h2 className="border-b border-slate-800 p-5 font-semibold">Production history</h2><table className="w-full text-left text-sm"><thead className="bg-slate-900 text-slate-400"><tr><th className="p-4">Run</th><th className="p-4">Date</th><th className="p-4 text-right">Planned</th><th className="p-4 text-right">Actual</th><th className="p-4 text-right">Variance</th><th className="p-4 text-right">Total cost</th><th className="p-4 text-right">Cost/unit</th></tr></thead><tbody>{runs.map(r => <tr key={r.id} className="border-t border-slate-800"><td className="p-4">{r.run_number}</td><td className="p-4 whitespace-nowrap">{new Date(r.created_at).toLocaleString("en-IN")}</td><td className="p-4 text-right">{Number(r.planned_output).toLocaleString("en-IN")}</td><td className="p-4 text-right">{Number(r.actual_output).toLocaleString("en-IN")}</td><td className={`p-4 text-right ${Number(r.yield_variance) < 0 ? "text-amber-400" : "text-emerald-400"}`}>{Number(r.yield_variance).toLocaleString("en-IN")}</td><td className="p-4 text-right">₹{Number(r.total_production_cost).toFixed(2)}</td><td className="p-4 text-right">₹{Number(r.cost_per_unit).toFixed(2)}</td></tr>)}{!runs.length && <tr><td colSpan={7} className="p-6 text-center text-slate-400">No production runs posted yet.</td></tr>}</tbody></table></section>
      </>}
    </main>
  );
}
