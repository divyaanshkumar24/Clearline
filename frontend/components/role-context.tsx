"use client";

import * as React from "react";
import { REVIEWERS } from "@/lib/mock-data";

/**
 * Single-user workspace — no persona split. Whoever signs in gets full
 * access: every screen, plus recording/uploading and reviewing their own
 * calls. The identity below is cosmetic (name/title shown in the topbar),
 * reusing the existing reviewer record rather than inventing a new one.
 */
export const CURRENT_USER = REVIEWERS[0]; // Janet Moss, Chief Compliance Officer

/**
 * Session-scoped auth: stored in sessionStorage so every fresh browser
 * session starts at the landing page, while navigation within a session
 * stays signed in.
 */
const AUTH_KEY = "clearline-auth";

interface RoleContextValue {
  /** true once the user has signed in via the landing page */
  signedIn: boolean;
  signIn: () => void;
  signOut: () => void;
  /** true once the client has hydrated the persisted session */
  ready: boolean;
}

const RoleContext = React.createContext<RoleContextValue>({
  signedIn: false,
  signIn: () => {},
  signOut: () => {},
  ready: false,
});

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [signedIn, setSignedIn] = React.useState(false);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    const stored = window.sessionStorage.getItem(AUTH_KEY);
    if (stored === "1") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSignedIn(true);
    }
    setReady(true);
  }, []);

  const signIn = React.useCallback(() => {
    setSignedIn(true);
    window.sessionStorage.setItem(AUTH_KEY, "1");
  }, []);

  const signOut = React.useCallback(() => {
    setSignedIn(false);
    window.sessionStorage.removeItem(AUTH_KEY);
  }, []);

  return (
    <RoleContext.Provider value={{ signedIn, signIn, signOut, ready }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  return React.useContext(RoleContext);
}
