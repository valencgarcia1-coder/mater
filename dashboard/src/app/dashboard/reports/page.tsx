import { redirect } from "next/navigation";
import Shell from "@/components/dashboard/Shell";
import ReportsPage from "@/components/dashboard/ReportsPage";
import { supabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardReportsPage() {
  if (supabaseConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");
  }
  return (
    <Shell>
      <ReportsPage />
    </Shell>
  );
}
