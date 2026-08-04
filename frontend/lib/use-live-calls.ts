"use client";

import * as React from "react";
import { adaptLiveCall, type BackendCallResult } from "./live-call";
import type { Call, TranscriptSegment } from "./types";

/**
 * Calls analyzed for real through /new-call, adapted into the same `Call` shape
 * the mock corpus uses so every screen can merge the two with a spread.
 *
 * The rest of the app is demo data and must keep working with no backend
 * running, so a failure here is not an error state — it resolves to an empty
 * list and the page renders its mock corpus alone.
 */
export type LiveCallsState = {
  calls: Call[];
  transcripts: Record<string, TranscriptSegment[]>;
  loading: boolean;
};

const EMPTY: LiveCallsState = { calls: [], transcripts: {}, loading: false };

export function useLiveCalls(): LiveCallsState {
  const [state, setState] = React.useState<LiveCallsState>({ ...EMPTY, loading: true });

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/calls", { cache: "no-store" });
        const data = await res.json().catch(() => null);
        const results: BackendCallResult[] = Array.isArray(data?.calls) ? data.calls : [];

        const calls: Call[] = [];
        const transcripts: Record<string, TranscriptSegment[]> = {};
        for (const result of results) {
          // One malformed call must not blank out the others.
          try {
            const adapted = adaptLiveCall(result);
            calls.push(adapted.call);
            transcripts[adapted.call.id] = adapted.transcript;
          } catch {
            continue;
          }
        }

        if (!cancelled) setState({ calls, transcripts, loading: false });
      } catch {
        if (!cancelled) setState(EMPTY);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
