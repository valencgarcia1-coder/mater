import type { Metadata } from "next";
import Dashboard from "@/components/Dashboard";

export const metadata: Metadata = {
  title: "Live Ops",
};

export default function DashboardPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10 sm:px-10">
      <Dashboard />
    </main>
  );
}
