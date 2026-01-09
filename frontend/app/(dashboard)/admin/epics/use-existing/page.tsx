"use client";

import { useRouter } from "next/navigation";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { Button } from "antd";
import UseExistingEpicContent from "../components/UseExistingEpicContent";
import { getRoleBase } from "@/app/lib/paths";
import { usePathname } from "next/navigation";

export default function UseExistingEpicPage() {
  const router = useRouter();
  const pathname = usePathname();
  const roleBase = getRoleBase(pathname || '');

  const handleCreated = () => {
    router.push(`${roleBase}/epics`);
  };

  const handleCancel = () => {
    router.push(`${roleBase}/epics`);
  };

  return (
    <div className="p-4 sm:p-6" style={{ fontFamily: 'var(--font-poppins), Poppins, sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex items-center gap-3">
          <Button
            icon={<ArrowLeftOutlined />}
            type="text"
            onClick={handleCancel}
            className="p-0"
          />
          <h1 className="text-xl font-bold text-gray-900">Use Existing Template</h1>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <UseExistingEpicContent
          onCreated={handleCreated}
          onCancel={handleCancel}
        />
      </div>
    </div>
  );
}

