"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUserOptional } from "@/contexts/UserContext";
import { LandingPage } from "@/components/landing/LandingPage";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { Loader2 } from "lucide-react";

/**
 * Full-page loader with no landing chrome. Shown at "/" while auth is resolving
 * so we never flash the landing before redirect.
 */
function FullPageLoader({ label }: { label: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2
        className="size-8 animate-spin text-muted-foreground"
        aria-label={label}
      />
    </div>
  );
}

/**
 * Only mounted at "/" (root page). When unauthenticated: show landing (with header).
 * When authenticated: redirect to /[user_id]. While auth is resolving: show
 * only a loader. Does not use pathname so we avoid flicker when the router
 * updates during transitions.
 */
export function AuthRedirectOrLanding() {
  const router = useRouter();
  const { user, isLoading } = useUserOptional();
  const hasResolvedUnauthenticated = useRef(false);

  useEffect(() => {
    if (isLoading) return;
    if (user?.subject) {
      router.replace(`/${user.subject}`);
      return;
    }
    hasResolvedUnauthenticated.current = true;
  }, [user?.subject, isLoading, router]);

  if (user?.subject) {
    return <FullPageLoader label="Redirecting" />;
  }

  if (!isLoading || hasResolvedUnauthenticated.current) {
    return (
      <div className="min-h-screen flex flex-col">
        <LandingHeader />
        <main className="flex-1 min-w-0">
          <LandingPage />
        </main>
      </div>
    );
  }

  return <FullPageLoader label="Loading" />;
}
