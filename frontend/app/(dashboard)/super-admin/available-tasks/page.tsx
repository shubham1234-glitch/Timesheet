"use client";

import AvailableTasksView from "@/app/components/AvailableTasksView";

export default function SuperAdminAvailableTasksPage() {
  return (
    <AvailableTasksView
      title="Available Tasks"
      description="Organization-wide tasks assigned to your team and yet to be picked up."
    />
  );
}

