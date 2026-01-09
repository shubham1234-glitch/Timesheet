import React from 'react';
import { Epic } from "@/app/types/EpicTypes";
import EpicMetadata from './EpicMetadata';
import EpicClientDetails from './EpicClientDetails';

interface EpicRightPanelProps {
  epicData: Epic;
  onEpicDataChange: (field: keyof Epic, value: Epic[keyof Epic]) => void;
  isReadOnly?: boolean;
  onStatusChange?: (newStatus: string, reason?: string) => void;
}

const EpicRightPanel: React.FC<EpicRightPanelProps> = ({
  epicData,
  onEpicDataChange,
  isReadOnly = false,
  onStatusChange,
}) => {
  return (
    <div className="w-full lg:w-[30%] flex flex-col gap-3 lg:sticky lg:top-2 self-start">
      <EpicMetadata epicData={epicData} onEpicDataChange={onEpicDataChange} isReadOnly={isReadOnly} onStatusChange={onStatusChange} />
      <EpicClientDetails epicData={epicData} isReadOnly={isReadOnly} />
    </div>
  );
};

export default EpicRightPanel;

