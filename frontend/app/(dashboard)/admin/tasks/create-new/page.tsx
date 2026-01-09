"use client";

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import CreateTaskForm from '@/app/(dashboard)/admin/epics/[id]/components/CreateTaskForm';
import { getRoleBase, buildRoleHref } from '@/app/lib/paths';

export default function CreateNewTaskPage() {
  const router = useRouter();
  const pathname = usePathname();
  const roleBase = getRoleBase(pathname || '');

  const handleTaskCreated = () => {
    // Redirect back to tasks list page
    router.push(buildRoleHref(roleBase, `/tasks`));
  };

  const handleCancel = () => {
    // Redirect back to tasks list page
    router.push(buildRoleHref(roleBase, `/tasks`));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
        {/* Compact Header */}
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-900">Create New Task</h1>
          <p className="text-xs text-gray-500 mt-1">Fill in the details below to create a new task</p>
        </div>

        {/* Form Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 lg:p-8">
          <CreateTaskForm 
            onCreated={handleTaskCreated} 
            onCancel={handleCancel}
            hideCreateButton={true}
          />
        </div>
      </div>
    </div>
  );
}

