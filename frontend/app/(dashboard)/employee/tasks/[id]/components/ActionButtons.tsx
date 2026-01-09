import React from 'react';
import { Button } from 'antd';

const ActionButtons: React.FC = () => {
  const handleSave = () => {
    console.log('Save clicked');
  };

  const handleSubmit = () => {
    console.log('Submit clicked');
  };

  return (
    <div className="bg-white shadow-lg rounded-xl p-4 text-xs">
      <div className="space-y-2">
        <Button
          onClick={handleSave}
          type="primary"
          size="small"
          className="w-full text-[12px]"
        >
          Save
        </Button>
        <Button
          onClick={handleSubmit}
          size="small"
          className="w-full text-[12px]"
        >
          Submit
        </Button>
      </div>
    </div>
  );
};

export default ActionButtons;
