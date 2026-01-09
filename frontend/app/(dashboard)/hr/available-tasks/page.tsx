"use client";

import AvailableTasksView from "@/app/components/AvailableTasksView";

export default function HrAvailableTasksPage() {
  return (
    <AvailableTasksView
      title="Available Tasks"
      description="Tasks assigned to your HR team and not yet picked up by any member."
    />
  );
}

