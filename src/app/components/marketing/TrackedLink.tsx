"use client";

import { useCallback, type ComponentProps } from "react";

import Link from "next/link";

import {
  trackSearchCta,
  type SearchSource,
} from "@/lib/client/search-analytics";

type TrackedLinkProps = Omit<ComponentProps<typeof Link>, "onClick"> & {
  source: SearchSource;
};

export default function TrackedLink({ source, ...props }: TrackedLinkProps) {
  const onClick = useCallback(() => trackSearchCta(source), [source]);
  // Preserve a normal crawlable link and all native keyboard/navigation behavior.
  // eslint-disable-next-line react/jsx-props-no-spreading
  return <Link {...props} onClick={onClick} />;
}
