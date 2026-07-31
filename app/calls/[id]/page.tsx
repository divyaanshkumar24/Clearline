import { CALLS } from "@/lib/mock-data";
import { CallDetail } from "./call-detail";

export function generateStaticParams() {
  return CALLS.map((c) => ({ id: c.id }));
}

// Ids outside the mock dataset aren't 404s here — they're real backend call_ids
// from /new-call, which CallDetail fetches and adapts client-side.
export default async function CallDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CallDetail callId={id} />;
}
