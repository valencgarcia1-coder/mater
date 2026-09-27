import { redirect } from "next/navigation";
import Shell from "@/components/dashboard/Shell";
import CameraMap from "@/components/dashboard/CameraMap";
import { supabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export default async function CameraMapPage() {
  if (supabaseConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");
  }
  return (
    <Shell>
      <CameraMap />
    </Shell>
  );
}
