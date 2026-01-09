"use client";

import React from 'react';
import { useRouter, usePathname, useParams } from 'next/navigation';
import CreateTaskForm from '../../components/CreateTaskForm';
import { getRoleBase, buildRoleHref } from '@/app/lib/paths';

export default function CreateNewTaskPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ id: string }>();
  const epicId = (params?.id || '').toString();
  const roleBase = getRoleBase(pathname || '');

  // Check if we came from use-existing page
  const getReturnUrl = () => {
    if (typeof window !== 'undefined') {
      const returnUrl = sessionStorage.getItem('taskCreationReturnUrl');
      if (returnUrl) {
        sessionStorage.removeItem('taskCreationReturnUrl');
        return returnUrl;
      }
    }
    // Default redirect based on epicId
    if (epicId === 'new' || !epicId) {
      return buildRoleHref(roleBase, '/epics/use-existing');
    }
    // Redirect to epics list page with the epic expanded
    return buildRoleHref(roleBase, `/epics?expandedEpic=${epicId}`);
  };

  const handleTaskCreated = () => {
    // Redirect to the return URL or default location
    const returnUrl = getReturnUrl();
    router.push(returnUrl);
  };

  const handleCancel = () => {
    const returnUrl = getReturnUrl();
    router.push(returnUrl);
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
            epicId={epicId} 
            onCreated={handleTaskCreated} 
            onCancel={handleCancel} 
          />
        </div>
      </div>
    </div>
  );
}

