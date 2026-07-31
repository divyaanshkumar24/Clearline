import { ProcessingStatus } from "./processing-status";

export default async function CallProcessingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProcessingStatus callId={id} />;
}
