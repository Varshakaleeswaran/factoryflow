import Link from "next/link";

const modules = [
  { name: "Sales & Orders", desc: "Create, approve and track customer orders.", icon: "↗", href: "/sales" },
  { name: "Inventory", desc: "Manage raw materials and finished goods.", icon: "▦", href: "/inventory" },
  { name: "Production", desc: "Production runs, BOM and material consumption.", icon: "⚙", href: "/production" },
  { name: "Purchases", desc: "Supplier purchases and material receipts.", icon: "↓", href: "/purchases" },
  { name: "Dispatch", desc: "Track approved orders and deliveries.", icon: "⇢", href: "/dispatch" },
  { name: "Cost Intelligence", desc: "Yield, wastage and production cost analysis.", icon: "₹", href: "/costing" },
  { name: "AuditIQ", desc: "Trace transactions and investigate exceptions.", icon: "⌕", href: "/audit" },
  { name: "Reports", desc: "Sales, stock and financial reports.", icon: "▤", href: "/reports" },
];

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-[#080d19] text-slate-100">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-slate-800 bg-[#0c1424] p-6 md:block">
          <div className="text-2xl font-bold tracking-tight">Factory<span className="text-blue-400">Flow</span></div>
          <p className="mt-1 text-xs text-slate-500">ORDER-TO-AUDIT INTELLIGENCE</p>
          <div className="mt-10 text-xs font-semibold uppercase tracking-widest text-slate-500">Workspace</div>
          <nav className="mt-4 space-y-2">
            <Link className="block rounded-lg bg-blue-500/15 px-4 py-3 text-blue-300" href="/dashboard">Overview</Link>
            {modules.map((m) => (
              <Link key={m.name} className="block rounded-lg px-4 py-3 text-sm text-slate-400 hover:bg-slate-800 hover:text-white" href={m.href}>
                {m.name}
              </Link>
            ))}
          </nav>
          <div className="mt-12 rounded-xl border border-slate-800 p-4">
            <p className="text-sm font-semibold">FactoryFlow Demo Foods</p>
            <p className="mt-1 text-xs text-slate-500">Demo workspace</p>
          </div>
        </aside>

        <section className="min-w-0 flex-1 p-5 md:p-9">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-6">
            <div>
              <p className="text-sm text-slate-400">Factory workspace / Overview</p>
              <h1 className="mt-2 text-3xl font-bold">Operations overview</h1>
              <p className="mt-1 text-sm text-slate-400">Monitor orders, inventory and production in one place.</p>
            </div>
            <div className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300">Demo environment</div>
          </header>

          <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Pending orders", "—", "Live data not connected"],
              ["Finished stock", "—", "Live data not connected"],
              ["Production runs", "—", "Live data not connected"],
              ["Receivables", "—", "Live data not connected"],
            ].map(([label, value, note]) => (
              <div key={label} className="rounded-xl border border-slate-800 bg-[#101a2c] p-5">
                <p className="text-sm text-slate-400">{label}</p>
                <p className="mt-3 text-3xl font-bold">{value}</p>
                <p className="mt-2 text-xs text-slate-500">{note}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Operations modules</h2>
              <p className="mt-1 text-sm text-slate-400">Select a module to manage factory operations.</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {modules.map((m) => (
              <Link key={m.name} href={m.href} className="group rounded-xl border border-slate-800 bg-[#101a2c] p-5 transition hover:border-blue-500/60 hover:bg-[#14213a]">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-500/15 text-xl text-blue-300">{m.icon}</div>
                <h3 className="mt-4 font-semibold group-hover:text-blue-300">{m.name}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{m.desc}</p>
                <p className="mt-4 text-xs font-semibold text-blue-400">OPEN MODULE →</p>
              </Link>
            ))}
          </div>

          <footer className="mt-12 border-t border-slate-800 pt-5 text-xs text-slate-500">
            FactoryFlow · Order-to-Audit Intelligence System · Prototype
          </footer>
        </section>
      </div>
    </main>
  );
}
