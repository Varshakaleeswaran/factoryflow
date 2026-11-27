"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import InvoiceButton from "./invoice-button";

type Customer = { id: string; name: string };
type Product = { id: string; name: string; sku: string };
type Order = {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  order_date: string;
};

export default function SalesPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [userId, setUserId] = useState("");
  const [memberRole, setMemberRole] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("50");
  const [gstRate, setGstRate] = useState("5");
  const [orderDate, setOrderDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const supabase = createClient();

  async function loadData() {
    setLoading(true);
    setMessage("");

    const { data: authData, error: authError } =
      await supabase.auth.getUser();

    if (authError || !authData.user) {
      setMessage("Please sign in before opening Sales.");
      setLoading(false);
      return;
    }

    setUserId(authData.user.id);

    const { data: membership, error: memberError } = await supabase
      .from("organization_members")
      .select("organization_id,role")
      .eq("user_id", authData.user.id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (memberError || !membership) {
      setMessage("No active organization membership found.");
      setLoading(false);
      return;
    }

    const orgId = membership.organization_id;
    setOrganizationId(orgId);
    setMemberRole(membership.role);

    const [customerResult, productResult, orderResult] = await Promise.all([
      supabase
        .from("customers")
        .select("id,name")
        .eq("organization_id", orgId)
        .order("name"),
      supabase
        .from("items")
        .select("id,name,sku")
        .eq("organization_id", orgId)
        .eq("item_type", "finished_good")
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("sales_orders")
        .select("id,order_number,status,total_amount,order_date")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false }),
    ]);

    if (customerResult.error || productResult.error || orderResult.error) {
      setMessage(
        customerResult.error?.message ||
        productResult.error?.message ||
        orderResult.error?.message ||
        "Unable to load Sales data."
      );
    } else {
      setCustomers(customerResult.data || []);
      setProducts(productResult.data || []);
      setOrders(orderResult.data || []);
      setCustomerId(customerResult.data?.[0]?.id || "");
      setProductId(productResult.data?.[0]?.id || "");
    }

    setLoading(false);
  }

  useEffect(() => {
    setOrderDate(new Date().toISOString().slice(0, 10));
    loadData();
  }, []);

  const qty = Math.max(0, Number(quantity) || 0);
  const price = Math.max(0, Number(unitPrice) || 0);
  const rate = Math.max(0, Number(gstRate) || 0);
  const subtotal = qty * price;
  const tax = subtotal * rate / 100;
  const total = subtotal + tax;

  async function createOrder(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    if (!organizationId || !userId || !customerId || !productId) {
      setMessage("Select a customer and product first.");
      return;
    }

    if (!Number.isInteger(qty) || qty < 1 || price <= 0 || rate < 0 || rate > 100) {
      setMessage("Enter a valid quantity, price and GST rate.");
      return;
    }

    setSaving(true);

    const { data, error } = await supabase.rpc("create_sales_order", {
      p_customer_id: customerId,
      p_order_date: orderDate || null,
      p_notes: null,
      p_item_id: productId,
      p_quantity: qty,
      p_unit_price: price,
      p_gst_rate: rate,
    });

    if (error) {
      setMessage("Order creation failed: " + error.message);
      setSaving(false);
      return;
    }

    const createdOrder = Array.isArray(data) ? data[0] : data;

    if (!createdOrder) {
      setMessage("The database did not return the created order.");
      setSaving(false);
      return;
    }

    setMessage("Order " + createdOrder.order_number + " created successfully!");
    setQuantity("1");
    await loadData();
    setSaving(false);
  }


  async function approveOrder(orderId: string) {
    setMessage("");
    setSaving(true);

    const { error } = await supabase.rpc("approve_sales_order", {
      p_order_id: orderId,
    });

    if (error) {
      setMessage("Approval failed: " + error.message);
    } else {
      setMessage("Order approved successfully.");
      await loadData();
    }

    setSaving(false);
  }
  return (
    <main className="min-h-screen bg-[#080d19] p-6 text-white md:p-10">
      <Link href="/dashboard" className="text-sm text-blue-400">
        ← Back to dashboard
      </Link>

      <header className="mt-7">
        <p className="text-sm text-slate-400">Sales management</p>
        <h1 className="mt-2 text-3xl font-bold">Sales & Orders</h1>
        <p className="mt-2 text-sm text-slate-400">
          Create and track customer orders.
        </p>
      </header>

      {message && (
        <div className="mt-6 break-words rounded-lg border border-slate-700 bg-slate-900 p-4 text-sm">
          {message}
        </div>
      )}

      {loading ? (
        <p className="mt-8 text-slate-400">Loading sales data...</p>
      ) : (
        <>
          <section className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              ["Total orders", orders.length],
              ["Awaiting approval", orders.filter(o => o.status === "pending_approval").length],
              ["Dispatched", orders.filter(o => o.status === "dispatched").length],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-800 bg-[#101a2c] p-5">
                <p className="text-sm text-slate-400">{label}</p>
                <p className="mt-3 text-3xl font-bold">{value}</p>
              </div>
            ))}
          </section>

          <form onSubmit={createOrder} className="mt-8 rounded-xl border border-slate-800 bg-[#101a2c] p-6">
            <h2 className="text-xl font-semibold">Create customer order</h2>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <label className="text-sm text-slate-300">
                Customer
                <select required value={customerId} onChange={e => setCustomerId(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 p-3">
                  <option value="">Select customer</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>

              <label className="text-sm text-slate-300">
                Order date
                <input type="date" required value={orderDate} onChange={e => setOrderDate(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 p-3" />
              </label>

              <label className="text-sm text-slate-300">
                Product
                <select required value={productId} onChange={e => setProductId(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 p-3">
                  <option value="">Select product</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                </select>
              </label>

              <label className="text-sm text-slate-300">
                Quantity (packets)
                <input type="number" min="1" step="1" required value={quantity} onChange={e => setQuantity(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 p-3" />
              </label>

              <label className="text-sm text-slate-300">
                Unit price (₹)
                <input type="number" min="0.01" step="0.01" required value={unitPrice} onChange={e => setUnitPrice(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 p-3" />
              </label>

              <label className="text-sm text-slate-300">
                Demo GST rate (%)
                <input type="number" min="0" max="100" step="0.01" value={gstRate} onChange={e => setGstRate(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 p-3" />
              </label>
            </div>

            <div className="mt-6 rounded-lg bg-slate-900 p-5">
              <div className="flex justify-between text-sm text-slate-300">
                <span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="mt-2 flex justify-between text-sm text-slate-300">
                <span>Demo tax</span><span>₹{tax.toFixed(2)}</span>
              </div>
              <div className="mt-3 flex justify-between border-t border-slate-700 pt-3 font-semibold">
                <span>Total</span><span>₹{total.toFixed(2)}</span>
              </div>
            </div>

            <button disabled={saving || customers.length === 0 || products.length === 0} className="mt-6 rounded-lg bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500 disabled:opacity-50">
              {saving ? "Saving order..." : "Save order"}
            </button>
          </form>

          <section className="mt-8 overflow-x-auto rounded-xl border border-slate-800 bg-[#101a2c]">
            <div className="border-b border-slate-800 p-5">
              <h2 className="font-semibold">Recent orders</h2>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900 text-slate-400">
                <tr>
                  <th className="p-4">Order</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Total</th>
                  <th className="p-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id} className="border-t border-slate-800">
                    <td className="p-4 font-medium">{o.order_number}</td>
                    <td className="p-4">{o.order_date}</td>
                    <td className="p-4">{o.status.replaceAll("_", " ")}</td>
                    <td className="p-4 text-right">₹{Number(o.total_amount).toFixed(2)}</td>
                    <td className="p-4 text-center">
                      {memberRole === "owner" || memberRole === "admin" || memberRole === "accountant" ? (
                        o.status === "pending_approval" && memberRole !== "accountant" ? (
                          <button type="button" disabled={saving} onClick={() => approveOrder(o.id)} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold hover:bg-emerald-500 disabled:opacity-50">
                            Approve
                          </button>
                        ) : o.status === "approved" ? (
                          <InvoiceButton orderId={o.id} />
                        ) : <span className="text-slate-400">—</span>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr><td colSpan={5} className="p-8 text-center text-slate-400">No orders created yet.</td></tr>
                )}
              </tbody>
            </table>
          </section>
        </>
      )}
    </main>
  );
}



