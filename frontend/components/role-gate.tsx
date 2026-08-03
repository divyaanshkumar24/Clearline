"use client";

import * as React from "react";
import { ShieldOff } from "lucide-react";
import { ButtonLink } from "@/components/button-link";
import { EmptyState } from "@/components/shared";
import { useRole } from "@/components/role-context";

/**
 * Renders one of two server-rendered variants based on the client-side role.
 * SSR/first paint shows the admin variant (the default role), then swaps
 * after hydration if the persisted persona is a representative.
 */
export function RoleGate({
  admin,
  rep,
}: {
  admin: React.ReactNode;
  rep: React.ReactNode;
}) {
  const { role, ready } = useRole();
  if (!ready || role === "admin") return <>{admin}</>;
  return <>{rep}</>;
}

export function AccessDenied({ screen }: { screen: string }) {
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 md:px-6 lg:px-8">
      <EmptyState
        icon={<ShieldOff className="size-5" />}
        title={`${screen} requires compliance permissions`}
        description="You're signed in as a representative. This area is restricted to the compliance team — your personal results live in My Performance and My Calls."
        action={
          <ButtonLink href="/" size="sm">
            Go to My Performance
          </ButtonLink>
        }
        className="mt-10"
      />
    </div>
  );
}
