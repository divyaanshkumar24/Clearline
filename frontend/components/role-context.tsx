"use client";

import * as React from "react";
import { REPRESENTATIVES, REVIEWERS } from "@/lib/mock-data";

export type Role = "admin" | "rep";

/** Fixed demo personas — no real auth in this prototype */
export const ADMIN_PERSONA = REVIEWERS[0]; // Janet Moss, CCO
export const REP_PERSONA = REPRESENTATIVES.find((r) => r.id === "rep-02")!; // Daniel Reyes

/**
 * Session-scoped auth: stored in sessionStorage so every fresh browser
 * session starts at the landing page, while navigation within a session
 * stays signed in.
 */
const AUTH_KEY = "clearline-auth";

interface RoleContextValue {
  role: Role;
  /** true once a persona was chosen via the landing page (or persona switcher) */
  signedIn: boolean;
  /** choose/switch persona — also marks the session as signed in */
  setRole: (r: Role) => void;
  signOut: () => void;
  /** true once the client has hydrated the persisted session */
  ready: boolean;
}

const RoleContext = React.createContext<RoleContextValue>({
  role: "admin",
  signedIn: false,
  setRole: () => {},
  signOut: () => {},
  ready: false,
});

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = React.useState<Role>("admin");
  const [signedIn, setSignedIn] = React.useState(false);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    const stored = window.sessionStorage.getItem(AUTH_KEY);
    if (stored === "rep" || stored === "admin") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRoleState(stored);
      setSignedIn(true);
    }
    setReady(true);
  }, []);

  const setRole = React.useCallback((r: Role) => {
    setRoleState(r);
    setSignedIn(true);
    window.sessionStorage.setItem(AUTH_KEY, r);
  }, []);

  const signOut = React.useCallback(() => {
    setSignedIn(false);
    window.sessionStorage.removeItem(AUTH_KEY);
  }, []);

  return (
    <RoleContext.Provider value={{ role, signedIn, setRole, signOut, ready }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  return React.useContext(RoleContext);
}
