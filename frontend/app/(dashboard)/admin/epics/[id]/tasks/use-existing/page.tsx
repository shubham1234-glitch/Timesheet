"use client";

import React from 'react';
import { useRouter, usePathname, useParams } from 'next/navigation';
import UseExistingTaskContent from '../../components/UseExistingTaskContent';
import { getRoleBase, buildRoleHref } from '@/app/lib/paths';

export default function UseExistingTaskPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ id: string }>();
  const epicId = (params?.id || '').toString();
  const roleBase = getRoleBase(pathname || '');

  const handleTaskCreated = () => {
    // After creating a task from template, redirect back to the epics list page
    router.push(buildRoleHref(roleBase, `/epics`));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
        {/* Compact Header */}
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-900">Create Task from Template</h1>
          <p className="text-xs text-gray-500 mt-1">Select a template to quickly create a task</p>
        </div>

        {/* Form Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 lg:p-8">
          <UseExistingTaskContent 
            epicId={epicId} 
            onCreated={handleTaskCreated} 
            // Cancel should also go back to the epics list instead of epic details
            onCancel={() => router.push(buildRoleHref(roleBase, `/epics`))} 
          />
        </div>
      </div>
    </div>
  );
}

