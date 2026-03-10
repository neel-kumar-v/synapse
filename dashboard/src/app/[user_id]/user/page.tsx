"use client";

import { Loader2 } from "lucide-react";
import { useUser } from "@/contexts/UserContext";

export default function UserProfilePage() {
  const { user, isLoading } = useUser();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-muted-foreground" aria-label="Loading" />
      </div>
    );
  }

  if (user === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        Not signed in.
      </div>
    );
  }

  const picture = user.picture as string | undefined;
  return (
    <div className="px-6 py-12">
      <h1 className="text-2xl font-semibold mb-6">Profile</h1>
      <div className="rounded-lg border bg-card p-6 space-y-4">
        {picture && (
          <div>
            <span className="text-sm text-muted-foreground">Photo</span>
            <img src={picture} alt="" className="mt-1 size-16 rounded-full object-cover" />
          </div>
        )}
        {user.name != null && (
          <div>
            <span className="text-sm text-muted-foreground">Name</span>
            <p className="font-medium">{user.name}</p>
          </div>
        )}
        {user.email != null && (
          <div>
            <span className="text-sm text-muted-foreground">Email</span>
            <p className="font-medium">{user.email}</p>
          </div>
        )}
        {user.subject != null && (
          <div>
            <span className="text-sm text-muted-foreground">User ID</span>
            <p className="font-mono text-sm truncate">{user.subject}</p>
          </div>
        )}
      </div>
    </div>
  );
}
