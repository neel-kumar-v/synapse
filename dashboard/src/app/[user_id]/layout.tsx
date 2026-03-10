"use client";

import { useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { Loader2 } from "lucide-react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { DashboardHeader } from "@/components/DashboardHeader";
import { useUser } from "@/contexts/UserContext";

const REDIRECT_TO_ROOT_DELAY_MS = 400;

export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const router = useRouter();
  const user_id = params?.user_id as string | undefined;
  const { user, isLoading } = useUser();
  const upsertUserEmail = useMutation(api.userEmails.upsertUserEmail);
  const redirectToRootTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (user?.subject && user?.email) {
      upsertUserEmail({ userId: user.subject, email: user.email }).catch(() => {});
    }
  }, [user?.subject, user?.email, upsertUserEmail]);

  useEffect(() => {
    if (isLoading || !user_id) {
      if (redirectToRootTimeoutRef.current != null) {
        clearTimeout(redirectToRootTimeoutRef.current);
        redirectToRootTimeoutRef.current = null;
      }
      return;
    }
    if (user === null) {
      redirectToRootTimeoutRef.current = setTimeout(() => {
        redirectToRootTimeoutRef.current = null;
        router.replace("/");
      }, REDIRECT_TO_ROOT_DELAY_MS);
      return () => {
        if (redirectToRootTimeoutRef.current != null) {
          clearTimeout(redirectToRootTimeoutRef.current);
          redirectToRootTimeoutRef.current = null;
        }
      };
    }
    if (redirectToRootTimeoutRef.current != null) {
      clearTimeout(redirectToRootTimeoutRef.current);
      redirectToRootTimeoutRef.current = null;
    }
    if (user.subject && user_id !== user.subject) {
      router.replace(`/${user.subject}`);
    }
  }, [user, isLoading, user_id, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-muted-foreground" aria-label="Loading" />
      </div>
    );
  }

  if (user === null) {
    return null;
  }

  if (user.subject && user_id !== user.subject) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-muted-foreground" aria-label="Redirecting" />
      </div>
    );
  }

  if (!user_id) return null;

  return (
    <SidebarProvider>
      <AppSidebar userId={user_id} />
      <SidebarInset>
        <DashboardHeader />
        <div className="flex flex-1 flex-col min-h-screen">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
