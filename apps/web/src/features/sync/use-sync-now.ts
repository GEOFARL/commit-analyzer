"use client";

import { tsr } from "@/lib/api/tsr";

export const useSyncNowMutation = () => {
  return tsr.repos.syncNow.useMutation();
};
