"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Streak } from "@/types";

export function useStreaks() {
  const [streaks, setStreaks] = useState<Streak[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("streaks")
        .select("*")
        .eq("user_id", user.id);

      setStreaks(data ?? []);
      setLoading(false);
    };

    load();
  }, [supabase]);

  const getStreak = (type: Streak["streak_type"]) =>
    streaks.find((s) => s.streak_type === type);

  return { streaks, loading, getStreak };
}
