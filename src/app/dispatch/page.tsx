"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { Truck, RefreshCw, PackageCheck, AlertCircle } from "lucide-react";

type Order = {
  id: string;
  order_number: string;
  customer_id: string;
  order_date: string;
  status: string;
  total_amount: number;
};

type DispatchRecord = {
  id: string;
  sales_order_id: string;
  dispatch_number: string;
  dispatch_date: string;
  status: string;
  notes: string | null;
};

type OrderLine = {
  item_id: string;
  quantity: number;
  item_name: string;
  sku: string;
};

export default function DispatchPage() {
  const supabase = createClient();

  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Record<string, string>>({});
  const [invoices, setInvoices] = useState<Set<string>>(new Set());
  const [dispatches, setDispatches] = useState<DispatchRecord[]>([]);
  const [lines, setLines] = useState<Record<string, OrderLine[]>>({});
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError) throw authError;
      if (!authData.user) throw new Error("Please sign in first.");

      const { data: membership, error: memberError } = await supabase
        .from("organization_members")
        .select("organization_id, role")
        .eq("user_id", authData.user.id)
        .eq("is_active", true)
        .limit(1)
        .single();

      if (memberError) throw memberError;
      if (!["owner", "admin"].includes(membership.role)) {
        throw new Error("Dispatch posting is currently available to owners and admins.");
      }

      const orgId = membership.organization_id;

      const [
        orderResult,
        invoiceResult,
        customerResult,
        dispatchResult,
        itemResult,
      ] = await Promise.all([
        supabase.from("sales_orders").select("*")
          .eq("organization_id", orgId)
          .in("status", ["approved", "dispatched"])
          .order("created_at", { ascending: false }),
        supabase.from("invoices").select("sales_order_id")
          .eq("organization_id", orgId),
        supabase.from("customers").select("id, name")
          .eq("organization_id", orgId),
        supabase.from("dispatches").select("*")
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false }),
        supabase.from("items").select("id, name, sku")
          .eq("organization_id", orgId),
      ]);

      if (orderResult.error) throw orderResult.error;
      if (invoiceResult.error) throw invoiceResult.error;
      if (customerResult.error) throw customerResult.error;
      if (dispatchResult.error) throw dispatchResult.error;
      if (itemResult.error) throw itemResult.error;

      const orderData = (orderResult.data || []) as Order[];
      setOrders(orderData);
      setInvoices(new Set((invoiceResult.data || []).map((x: any) => x.sales_order_id)));
      setCustomers(Object.fromEntries(
        (customerResult.data || []).map((x: any) => [x.id, x.name])
      ));
      setDispatches((dispatchResult.data || []) as DispatchRecord[]);

      const orderIds = orderData.map((x) => x.id);
      const itemMap = Object.fromEntries(
        (itemResult.data || []).map((x: any) => [
          x.id,
          { name: x.name, sku: x.sku },
        ])
      );

      if (orderIds.length) {
        const { data: lineData, error: lineError } = await supabase
          .from("sales_order_items")
          .select("sales_order_id, item_id, quantity")
          .in("sales_order_id", orderIds);

        if (lineError) throw lineError;

        const grouped: Record<string, OrderLine[]> = {};
        for (const line of lineData || []) {
          const item = itemMap[line.item_id];
          if (!grouped[line.sales_order_id]) grouped[line.sales_order_id] = [];
          grouped[line.sales_order_id].push({
            item_id: line.item_id,
            quantity: line.quantity,
            item_name: item?.name || "Unknown item",
            sku: item?.sku || "",
          });
        }
        setLines(grouped);
      } else {
        setLines({});
      }
    } catch (e: any) {
      setError(e.message || "Could not load dispatch data.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function postDispatch(orderId: string) {
    if (busy) return;
    setBusy(orderId);
    setError("");
    setMessage("");

    const { data, error: rpcError } = await supabase.rpc(
      "dispatch_sales_order",
      {
        p_order_id: orderId,
        p_notes: notes.trim() || null,
      }
    );

    if (rpcError) {
      setError(rpcError.message);
    } else {
      const result = Array.isArray(data) ? data[0] : data;
      setMessage(
        `Dispatch ${result?.dispatch_number || ""} posted successfully.`
      );
      setNotes("");
      await loadData();
    }

    setBusy(null);
  }

  const readyOrders = orders.filter(
    (o) => o.status === "approved" && invoices.has(o.id)
  );

  return (
    <main className="min-h-screen bg-[#080d18] text-white p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-8">
        <Link href="/dashboard" className="text-blue-400 hover:text-blue-300">
          ← Back to dashboard
        </Link>

        <header className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <p className="text-sm text-blue-300">Factory operations</p>
            <h1 className="text-3xl font-bold mt-2">Dispatch Management</h1>
            <p className="text-slate-400 mt-2">
              Verify invoices, check finished stock and record customer dispatches.
            </p>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-3 hover:bg-slate-700"
          >
            <RefreshCw size={17} /> Refresh
          </button>
        </header>

        {message && (
          <div className="rounded-xl border border-green-700 bg-green-950/40 p-4 text-green-300">
            <PackageCheck className="inline mr-2" size={18} />
            {message}
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-red-800 bg-red-950/40 p-4 text-red-300">
            <AlertCircle className="inline mr-2" size={18} />
            {error}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Orders awaiting dispatch</p>
            <p className="text-3xl font-bold mt-2">{readyOrders.length}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Completed dispatches</p>
            <p className="text-3xl font-bold mt-2">{dispatches.length}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Invoiced approved orders</p>
            <p className="text-3xl font-bold mt-2">{readyOrders.length}</p>
          </div>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex items-center gap-2 mb-5">
            <Truck className="text-blue-400" />
            <h2 className="text-xl font-semibold">Orders ready for dispatch</h2>
          </div>

          <label className="block text-sm text-slate-400 mb-2">
            Dispatch notes (optional)
          </label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Vehicle, driver or delivery notes"
            className="w-full mb-5 rounded-lg border border-slate-700 bg-slate-950 p-3 outline-none focus:border-blue-500"
          />

          {loading ? (
            <p className="text-slate-400">Loading orders...</p>
          ) : readyOrders.length === 0 ? (
            <p className="text-slate-400">
              No invoiced approved orders are currently waiting for dispatch.
            </p>
          ) : (
            <div className="space-y-4">
              {readyOrders.map((order) => (
                <article
                  key={order.id}
                  className="rounded-xl border border-slate-700 bg-slate-950 p-5"
                >
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-lg">
                        {order.order_number}
                      </h3>
                      <p className="text-sm text-slate-400 mt-1">
                        {customers[order.customer_id] || "Customer"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        ₹{Number(order.total_amount).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </p>
                      <span className="text-xs text-green-400">
                        Approved · Invoiced
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-slate-800 pt-4">
                    <p className="text-sm text-slate-400 mb-2">Order items</p>
                    {(lines[order.id] || []).map((line) => (
                      <div
                        key={line.item_id}
                        className="flex justify-between gap-3 py-1 text-sm"
                      >
                        <span>
                          {line.item_name}{" "}
                          <span className="text-slate-500">{line.sku}</span>
                        </span>
                        <strong>{line.quantity} units</strong>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => postDispatch(order.id)}
                    disabled={!!busy || !(lines[order.id]?.length)}
                    className="mt-5 w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold hover:bg-blue-500 disabled:opacity-50"
                  >
                    {busy === order.id ? "Posting dispatch..." : "Dispatch full order"}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-xl font-semibold mb-5">Dispatch history</h2>
          {dispatches.length === 0 ? (
            <p className="text-slate-400">No dispatches recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-slate-400 border-b border-slate-700">
                  <tr>
                    <th className="py-3 pr-4">Dispatch number</th>
                    <th className="py-3 pr-4">Sales order</th>
                    <th className="py-3 pr-4">Date</th>
                    <th className="py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {dispatches.map((d) => (
                    <tr key={d.id} className="border-b border-slate-800">
                      <td className="py-3 pr-4 font-medium">{d.dispatch_number}</td>
                      <td className="py-3 pr-4">
                        {orders.find((o) => o.id === d.sales_order_id)?.order_number || "Order"}
                      </td>
                      <td className="py-3 pr-4">{d.dispatch_date}</td>
                      <td className="py-3 text-green-400">{d.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
