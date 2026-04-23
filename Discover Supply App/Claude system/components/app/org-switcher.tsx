"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setActiveOrg } from "@/app/actions/org";

type Membership = {
  orgId: string;
  role: string;
  org: { id: string; name: string };
};

export function OrgSwitcher({
  memberships,
  activeOrgId,
}: {
  memberships: Membership[];
  activeOrgId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <select
      value={activeOrgId}
      disabled={pending}
      onChange={(e) => {
        const id = e.target.value;
        startTransition(async () => {
          await setActiveOrg(id);
          router.refresh();
        });
      }}
      className="h-9 rounded-md border bg-background px-2 text-sm font-medium"
    >
      {memberships.map((m) => (
        <option key={m.orgId} value={m.orgId}>
          {m.org.name}
        </option>
      ))}
    </select>
  );
}
