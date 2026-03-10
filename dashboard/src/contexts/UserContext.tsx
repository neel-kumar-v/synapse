"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";

export type User = {
  subject: string;
  email?: string;
  name?: string;
  [key: string]: unknown;
};

type UserContextValue = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
};

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const identity = useQuery(api.auth.getCurrentUser);
  const isLoading = identity === undefined;
  const user = (identity as User | null | undefined) ?? null;
  const isAuthenticated = user !== null;

  const value: UserContextValue = {
    user,
    isLoading,
    isAuthenticated,
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (ctx === null) {
    throw new Error("useUser must be used within UserProvider");
  }
  return ctx;
}

export function useUserOptional(): UserContextValue {
  const ctx = useContext(UserContext);
  if (ctx === null) {
    return {
      user: null,
      isLoading: true,
      isAuthenticated: false,
    };
  }
  return ctx;
}
