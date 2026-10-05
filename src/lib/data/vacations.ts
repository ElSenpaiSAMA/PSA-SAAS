import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { VacationRequest } from "@/lib/supabase/database.types";

/** Todas las solicitudes visibles para el usuario en la org (propias + supervisadas, vía RLS). */
export const getVisibleVacationRequests = cache(
  async (membershipIds: string[]): Promise<VacationRequest[]> => {
    if (membershipIds.length === 0) return [];
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("vacation_requests")
      .select("*")
      .in("membership_id", membershipIds)
      .order("start_date", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
);
