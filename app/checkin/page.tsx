"use client";

import { motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import type { ApiResponse, CheckIn } from "@/lib/types";

type State =
  | { status: "loading"; message: string }
  | { status: "success"; message: string; checkIn: CheckIn; duplicate?: boolean }
  | { status: "error"; message: string };

function CheckInPanel() {
  const params = useSearchParams();
  const clientId = params.get("clientId");
  const posted = useRef(false);
  const [state, setState] = useState<State>({ status: "loading", message: "Recording your check-in" });

  useEffect(() => {
    if (posted.current) return;
    posted.current = true;

    if (!clientId) {
      setState({ status: "error", message: "Missing client ID" });
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    fetch("/api/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId }),
      signal: controller.signal
    })
      .then(async (response) => {
        const json = (await response.json()) as ApiResponse<{ checkIn: CheckIn; duplicate?: boolean }>;
        if (!json.success) throw new Error(json.error);
        setState({
          status: "success",
          message: json.message,
          checkIn: json.data.checkIn,
          duplicate: json.data.duplicate
        });
      })
      .catch((error) => {
        setState({
          status: "error",
          message: error.name === "AbortError" ? "Network timeout. Please rescan the QR code." : error.message
        });
      })
      .finally(() => clearTimeout(timeout));

    return () => controller.abort();
  }, [clientId]);

  return (
    <main className="grid min-h-screen place-items-center px-5 py-10">
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-lg bg-white p-8 text-center shadow-soft ring-1 ring-line"
      >
        {state.status === "loading" && (
          <>
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-red-600" />
            <h1 className="mt-6 text-2xl font-semibold text-ink">Checking you in</h1>
            <p className="mt-2 text-sm text-slate-500">{state.message}</p>
          </>
        )}

        {state.status === "success" && (
          <>
            <CheckCircle2 className="mx-auto h-14 w-14 text-red-600" />
            <h1 className="mt-6 text-2xl font-semibold text-ink">
              {state.duplicate ? "Already checked in" : "Checked in successfully"}
            </h1>
            <p className="mt-2 text-base font-medium text-slate-700">{state.checkIn.name}</p>
            <p className="mt-1 text-sm text-slate-500">{new Date(state.checkIn.timestamp).toLocaleString()}</p>
          </>
        )}

        {state.status === "error" && (
          <>
            <AlertCircle className="mx-auto h-14 w-14 text-red-500" />
            <h1 className="mt-6 text-2xl font-semibold text-ink">Invalid Client</h1>
            <p className="mt-2 text-sm text-slate-500">{state.message}</p>
          </>
        )}
      </motion.section>
    </main>
  );
}

export default function CheckInPage() {
  return (
    <Suspense fallback={null}>
      <CheckInPanel />
    </Suspense>
  );
}
