import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import type { PublicUser } from "@shared/schema";

interface AuthMeResponse {
  user: PublicUser;
}

export function useAuth() {
  const { data, isLoading } = useQuery<AuthMeResponse | null>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: false,
  });

  const user = data?.user ?? null;

  const isSubscribed =
    user?.subscriptionStatus === "trial" ||
    user?.subscriptionStatus === "active";

  let daysLeftInTrial: number | null = null;
  if (user?.subscriptionStatus === "trial" && user.trialEndsAt) {
    const msLeft = new Date(user.trialEndsAt).getTime() - Date.now();
    daysLeftInTrial = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
  }

  const isExpired = user?.subscriptionStatus === "expired";
  const isReadOnly = isExpired;

  return {
    user,
    isLoading,
    isSubscribed,
    isExpired,
    isReadOnly,
    daysLeftInTrial,
  };
}
