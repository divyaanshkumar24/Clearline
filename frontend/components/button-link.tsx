import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type ButtonLinkProps = Omit<
  React.ComponentProps<typeof Button>,
  "render" | "nativeButton"
> & { href: string };

export function ButtonLink({ href, children, ...props }: ButtonLinkProps) {
  return (
    <Button {...props} nativeButton={false} render={<Link href={href} />}>
      {children}
    </Button>
  );
}
