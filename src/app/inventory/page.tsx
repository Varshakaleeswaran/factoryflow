"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

type Item = {
  id: string;
  sku: string;
  name: string;
  item_type: string;
  unit_id: string;
  reorder_level: number;
};

type Unit = { id: string; symbol: string };

type Movement = {
  id: string;
  item_id: string;
  movement_type: string;
  quantity: number;
  unit_cost: number;
  notes: string | null;
  created_at: string;
};

const IN = [
  "opening", "purchase", "production_output",
  "sales_return", "adjustment"
];

const OUT = [
  "production_issue", "sale_dispatch",
  "purchase_return"
];

export default function InventoryPage() {
  const supabase = createClient();
  const [items, setItems] = useState<Item[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [itemId, setItemId] = useState("");
  const [movementType, setMovementType] = useState("opening");
  const [quantity, setQuantity] = useState("10");
  const [unitCost, setUnitCost] = useState("0");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadData() {
    setLoading(true);

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setMessage("Please sign in.");
      setLoading(false);
      return;
    }

    const { data: member, error: memberError } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", auth.user.id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (memberError || !member) {
      setMessage("Active organization membership not found.");
      setLoading(false);
      return;
    }

    const orgId = member.organization_id;

    const [itemResult, unitResult, movementResult, balanceResult] =
      await Promise.all([
        supabase.from("items")
          .select("id,sku,name,item_type,unit_id,reorder_level")
          .eq("organization_id", orgId)
          .eq("is_active", true)
          .order("name"),

        supabase.from("units")
          .select("id,symbol")
          .eq("organization_id", orgId),

        supabase.from("stock_movements")
          .select("id,item_id,movement_type,quantity,unit_cost,notes,created_at")
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false })
          .limit(100),

        supabase.from("stock_movements")
          .select("item_id,movement_type,quantity")
          .eq("organization_id", orgId)
      ]);

    const error = itemResult.error || unitResult.error ||
      movementResult.error || balanceResult.error;

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    const loadedItems = itemResult.data || [];
    setItems(loadedItems);
    setUnits(unitResult.data || []);
    setMovements(movementResult.data || []);

    const next: Record<string, number> = {};

    for (const movement of balanceResult.data || []) {
      const type = movement.movement_type;
      const sign = IN.includes(type) ? 1 :
        OUT.includes(type) ? -1 : 0;

      next[movement.item_id] =
        (next[movement.item_id] || 0) +
        sign * Number(movement.quantity);
    }

    setBalances(next);

    if (loadedItems.length && !loadedItems.some(i => i.id === itemId)) {
      setItemId(loadedItems[0].id);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function saveMovement(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    const qty = Number(quantity);
    const cost = Number(unitCost);

    if (!itemId || !Number.isFinite(qty) || qty <= 0 ||
        !Number.isFinite(cost) || cost < 0) {
      setMessage("Enter a valid item, quantity and unit cost.");
      return;
    }

    setSaving(true);

    const { data, error } = await supabase.rpc("record_stock_movement", {
      p_item_id: itemId,
      p_movement_type: movementType,
      p_quantity: qty,
      p_unit_cost: cost,
      p_notes: notes.trim() || null
    });

    if (error) {
      setMessage("Transaction failed: " + error.message);
    } else {
      const result = Array.isArray(data) ? data[0] : data;

      setMessage(
        "Stock saved. New balance: " +
        Number(result?.new_balance ?? 0).toLocaleString("en-IN")
      );

      setQuantity("10");
      setNotes("");
      await loadData();
    }

    setSaving(false);
  }

  const lowStock = items.filter(i =>
    (balances[i.id] || 0) <= Number(i.reorder_level || 0)
  );

  function unitSymbol(item: Item) {
    return units.find(u => u.id === item.unit_id)?.symbol || "";
  }

  return (
    <main className="min-h-screen bg-[#080d19] p-6 text-white md:p-10">
      <Link href="/dashboard" className="text-sm text-blue-400">
        ← Back to dashboard
      </Link>

      <header className="mt-7">
        <p className="text-sm text-slate-400">Factory operations</p>
        <h1 className="mt-2 text-3xl font-bold">Inventory Management</h1>
        <p className="mt-2 text-sm text-slate-400">
          Manage raw materials, packaging and finished goods.
        </p>
      </header>

      {message && (
        <div className="mt-6 rounded-lg border border-slate-700 bg-slate-900 p-4 text-sm">
          {message}
        </div>
      )}

      {loading ? (
        <p className="mt-8 text-slate-400">Loading inventory...</p>
      ) : (
        <>
          <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Total items", items.length],
              ["Raw materials", items.filter(i => i.item_type === "raw_material").length],
              ["Packaging", items.filter(i => i.item_type === "packaging").length],
              ["Finished goods", items.filter(i => i.item_type === "finished_good").length]
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-800 bg-[#101a2c] p-5">
                <p className="text-sm text-slate-400">{label}</p>
                <p className="mt-3 text-3xl font-bold">{value}</p>
              </div>
            ))}
          </section>

          <section className="mt-6 rounded-xl border border-amber-800/50 bg-amber-950/20 p-5">
            <p className="text-sm text-amber-300">Low-stock items</p>
            <p className="mt-2 text-2xl font-bold">{lowStock.length}</p>
          </section>

          <section className="mt-8 grid gap-6 lg:grid-cols-2">
            <form onSubmit={saveMovement} className="rounded-xl border border-slate-800 bg-[#101a2c] p-6">
              <h2 className="text-xl font-semibold">Record stock movement</h2>

              <label className="mt-5 block text-sm text-slate-300">
                Item
                <select required value={itemId}
                  onChange={e => setItemId(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 p-3">
                  {items.map(i => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.sku})
                    </option>
                  ))}
                </select>
              </label>

              <label className="mt-4 block text-sm text-slate-300">
                Movement type
                <select value={movementType}
                  onChange={e => setMovementType(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 p-3">
                  <option value="opening">Opening stock</option>
                  <option value="purchase">Purchase received</option>
                  <option value="production_output">Production output</option>
                  <option value="production_issue">Production consumption</option>
                  <option value="sale_dispatch">Dispatch</option>
                  <option value="adjustment">Stock adjustment</option>
                  <option value="sales_return">Sales return</option>
                  <option value="purchase_return">Purchase return</option>
                </select>
              </label>

              <label className="mt-4 block text-sm text-slate-300">
                Quantity
                <input type="number" min="0.001" step="0.001"
                  required value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 p-3" />
              </label>

              <label className="mt-4 block text-sm text-slate-300">
                Unit cost (₹)
                <input type="number" min="0" step="0.01"
                  required value={unitCost}
                  onChange={e => setUnitCost(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 p-3" />
              </label>

              <label className="mt-4 block text-sm text-slate-300">
                Notes / reference
                <textarea rows={3} value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 p-3" />
              </label>

              <button disabled={saving || !items.length}
                className="mt-6 w-full rounded-lg bg-blue-600 px-5 py-3 font-semibold disabled:opacity-50">
                {saving ? "Saving..." : "Save stock movement"}
              </button>
            </form>

            <section className="overflow-x-auto rounded-xl border border-slate-800 bg-[#101a2c]">
              <h2 className="border-b border-slate-800 p-5 font-semibold">
                Current stock balances
              </h2>
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900 text-slate-400">
                  <tr>
                    <th className="p-3">Item</th>
                    <th className="p-3">Type</th>
                    <th className="p-3 text-right">Balance</th>
                    <th className="p-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(i => {
                    const balance = balances[i.id] || 0;
                    const isLow = balance <= Number(i.reorder_level || 0);

                    return (
                      <tr key={i.id} className="border-t border-slate-800">
                        <td className="p-3">
                          <p>{i.name}</p>
                          <p className="text-xs text-slate-500">{i.sku}</p>
                        </td>
                        <td className="p-3 text-slate-400">
                          {i.item_type.replaceAll("_", " ")}
                        </td>
                        <td className="p-3 text-right">
                          {balance.toLocaleString("en-IN")} {unitSymbol(i)}
                        </td>
                        <td className={`p-3 text-right ${isLow ? "text-amber-400" : "text-emerald-400"}`}>
                          {isLow ? "Low stock" : "Available"}
                        </td>
                      </tr>
                    );
                  })}
                  {!items.length && (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-slate-400">
                        No active items found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          </section>

          <section className="mt-8 overflow-x-auto rounded-xl border border-slate-800 bg-[#101a2c]">
            <h2 className="border-b border-slate-800 p-5 font-semibold">
              Recent stock movements
            </h2>
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900 text-slate-400">
                <tr>
                  <th className="p-4">Date</th>
                  <th className="p-4">Item</th>
                  <th className="p-4">Movement</th>
                  <th className="p-4 text-right">Quantity</th>
                  <th className="p-4 text-right">Unit cost</th>
                  <th className="p-4">Notes</th>
                </tr>
              </thead>
              <tbody>
                {movements.map(m => (
                  <tr key={m.id} className="border-t border-slate-800">
                    <td className="p-4 whitespace-nowrap">
                      {new Date(m.created_at).toLocaleString("en-IN")}
                    </td>
                    <td className="p-4">
                      {items.find(i => i.id === m.item_id)?.name || "Unknown"}
                    </td>
                    <td className="p-4">{m.movement_type.replaceAll("_", " ")}</td>
                    <td className="p-4 text-right">
                      {(IN.includes(m.movement_type) ? "+" :
                        OUT.includes(m.movement_type) ? "-" : "↔") +
                        Number(m.quantity).toLocaleString("en-IN")}
                    </td>
                    <td className="p-4 text-right">
                      ₹{Number(m.unit_cost).toFixed(2)}
                    </td>
                    <td className="p-4">{m.notes || "—"}</td>
                  </tr>
                ))}
                {!movements.length && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-400">
                      No stock movements yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </>
      )}
    </main>
  );
}
