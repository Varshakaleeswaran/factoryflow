"use client";

import { useState } from "react";
import { jsPDF } from "jspdf";
import { createClient } from "@/utils/supabase/client";

type InvoiceButtonProps = {
  orderId: string;
};

export default function InvoiceButton({ orderId }: InvoiceButtonProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function generateInvoice() {
    setLoading(true);
    setMessage("");

    try {
      const supabase = createClient();

      const { data: result, error: rpcError } = await supabase.rpc(
        "generate_sales_invoice",
        { p_order_id: orderId }
      );

      if (rpcError) throw rpcError;

      const invoiceResult = Array.isArray(result) ? result[0] : result;

      if (!invoiceResult?.invoice_id) {
        throw new Error("Invoice ID was not returned by the database.");
      }

      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices")
        .select("*, invoice_items(*)")
        .eq("id", invoiceResult.invoice_id)
        .single();

      if (invoiceError) throw invoiceError;

      const pdf = new jsPDF();
      const items = invoice.invoice_items || [];

      pdf.setFontSize(20);
      pdf.text("FACTORYFLOW", 15, 20);

      pdf.setFontSize(11);
      pdf.text("DEMO SALES INVOICE", 15, 29);
      pdf.text(`Invoice No: ${invoice.invoice_number}`, 15, 42);
      pdf.text(`Invoice Date: ${invoice.invoice_date}`, 15, 50);

      pdf.text("SELLER", 15, 65);
      pdf.text(invoice.seller_name || "Not provided", 15, 72);
      pdf.text(`GSTIN: ${invoice.seller_gstin || "Not provided"}`, 15, 79);
      pdf.text(`State code: ${invoice.seller_state_code || "Not provided"}`, 15, 86);

      pdf.text("CUSTOMER", 110, 65);
      pdf.text(invoice.customer_name || "Not provided", 110, 72);
      pdf.text(invoice.customer_address || "Address not provided", 110, 79);
      pdf.text(`GSTIN: ${invoice.customer_gstin || "Not provided"}`, 110, 86);

      let y = 105;
      pdf.setFontSize(10);
      pdf.text("Item", 15, y);
      pdf.text("Qty", 100, y);
      pdf.text("Rate", 120, y);
      pdf.text("GST %", 150, y);
      pdf.text("Total", 175, y);

      y += 7;
      pdf.line(15, y - 4, 195, y - 4);

      for (const item of items) {
        if (y > 260) {
          pdf.addPage();
          y = 20;
        }

        pdf.text(String(item.item_name || "Item"), 15, y);
        pdf.text(String(item.quantity), 100, y);
        pdf.text(Number(item.unit_price).toFixed(2), 120, y);
        pdf.text(`${Number(item.gst_rate).toFixed(2)}%`, 150, y);
        pdf.text(Number(item.line_total).toFixed(2), 175, y);
        y += 9;
      }

      y += 8;
      pdf.line(120, y, 195, y);
      y += 9;
      pdf.text(`Subtotal: Rs. ${Number(invoice.subtotal).toFixed(2)}`, 120, y);
      y += 8;
      pdf.text(`Tax: Rs. ${Number(invoice.tax_amount).toFixed(2)}`, 120, y);
      y += 8;
      pdf.setFontSize(12);
      pdf.text(`Total: Rs. ${Number(invoice.total_amount).toFixed(2)}`, 120, y);

      pdf.setFontSize(8);
      pdf.text(
        "DEMO DOCUMENT - Not a legally validated GST tax invoice.",
        15,
        285
      );

      pdf.save(`${invoice.invoice_number}.pdf`);
      setMessage("Invoice PDF downloaded successfully.");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      setMessage("Invoice failed: " + errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={generateInvoice}
        disabled={loading}
        className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
      >
        {loading ? "Generating..." : "Generate PDF"}
      </button>
      {message && (
        <span className="max-w-52 text-xs text-slate-400">{message}</span>
      )}
    </div>
  );
}
