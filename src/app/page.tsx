
"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatus("");

    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setStatus(error.message);
      setLoading(false);
      return;
    }

    const { data, error: dbError } = await supabase
      .from("organizations")
      .select("name")
      .limit(1)
      .maybeSingle();

    if (dbError) {
      setStatus("Login successful, but database access failed: " + dbError.message);
    } else if (data) {
      window.location.href = "/dashboard"; return;
    } else {
      setStatus("Login successful, but no organization was found for this account.");
    }

    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">FactoryFlow</h1>
          <p className="mt-2 text-sm text-slate-400">
            Order-to-Audit Intelligence System
          </p>
        </div>

        <h2 className="text-xl font-semibold">Welcome back</h2>
        <p className="mt-1 text-sm text-slate-400">
          Sign in to your factory workspace.
        </p>

        <form onSubmit={handleLogin} className="mt-7 space-y-5">
          <div>
            <label className="mb-2 block text-sm text-slate-300">
              Email address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 outline-none focus:border-blue-500"
              placeholder="Enter your email"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 outline-none focus:border-blue-500"
              placeholder="Enter your password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-3 font-semibold hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        {status && (
          <div className="mt-5 rounded-lg border border-slate-700 bg-slate-800 p-4 text-sm break-words">
            {status}
          </div>
        )}

        <p className="mt-8 text-center text-xs text-slate-500">
          Secure workspace Â· FactoryFlow
        </p>
      </div>
    </main>
  );
}

