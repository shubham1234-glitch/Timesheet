"use client";

import AvailableTasksView from "@/app/components/AvailableTasksView";

export default function EmployeeAvailableTasksPage() {
  return (
    <AvailableTasksView
      title="Available Tasks"
      description="These tasks are assigned to your team and are currently unassigned. Pick one to start working."
    />
  );
}

