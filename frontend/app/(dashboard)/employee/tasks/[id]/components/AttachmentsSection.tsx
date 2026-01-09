import React from 'react';
import { Upload, Button } from 'antd';
import { UploadOutlined, DownloadOutlined, SaveOutlined } from '@ant-design/icons';

interface EpicAttachment {
  id: number;
  file_name: string;
  file_path: string;
  file_url?: string; // Downloadable URL for the file
  file_type: string;
  file_size: string;
  purpose: string;
  created_by: string;
  created_at: string;
}

interface AttachmentsSectionProps {
  uploadedFiles: File[];
  onFileUpload: (files: File[]) => void;
  onFileRemove: (index: number) => void;
  onSave?: () => void; // Callback when Save button is clicked
  existingAttachments?: EpicAttachment[]; // Attachments from API
  isReadOnly?: boolean;
}

const AttachmentsSection: React.FC<AttachmentsSectionProps> = ({
  uploadedFiles,
  onFileUpload,
  onFileRemove,
  onSave,
  existingAttachments = [],
  isReadOnly = false,
}) => {
  const handleFileUpload = (info: { fileList: Array<{ originFileObj?: File }> }) => {
    // Get only files with originFileObj (actual selected files)
    // Always replace the entire list with newly selected files
    const files = info.fileList
      .map((file) => file.originFileObj)
      .filter((file): file is File => file !== undefined);
    
    // Replace the entire uploadedFiles list with the newly selected files
    // This ensures deleted files don't reappear
    onFileUpload(files);
  };

  const totalCount = existingAttachments.length + uploadedFiles.length;

  const handleDownload = (attachment: EpicAttachment) => {
    // Use file_url from API response (should be provided by backend)
    if (attachment?.file_url) {
      window.open(attachment.file_url, '_blank');
    } else {
      console.error('File URL not available for attachment:', {
        attachment,
        hasFileUrl: !!attachment?.file_url,
        hasFilePath: !!attachment?.file_path,
        fileName: attachment?.file_name,
      });
    }
  };

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-semibold text-gray-600">Attachments</label>
          <span className="text-[9px] bg-gray-200 text-gray-700 px-2 py-[2px] rounded-full">
            {totalCount}
          </span>
        </div>
        {!isReadOnly && (
          <div className="flex items-center gap-2">
            {uploadedFiles.length > 0 && onSave && (
              <Button 
                icon={<SaveOutlined />} 
                type="primary" 
                size="small" 
                className="text-[9px]"
                onClick={onSave}
              >
                Save
              </Button>
            )}
            <Upload
              key={uploadedFiles.length}
              beforeUpload={() => false}
              onChange={handleFileUpload}
              multiple
              showUploadList={false}
              fileList={[]}
            >
              <Button icon={<UploadOutlined />} type={uploadedFiles.length > 0 ? "default" : "primary"} size="small" className="text-[9px]">
                Upload
              </Button>
            </Upload>
          </div>
        )}
      </div>

      {/* Existing Attachments from API */}
      {existingAttachments.length > 0 && (
        <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2">
          {existingAttachments.map((attachment) => (
            <div 
              key={attachment.id} 
              className="group relative aspect-square bg-gray-50 border border-gray-200 rounded-md p-2 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer flex flex-col items-center justify-center"
              onClick={(e) => {
                e.preventDefault();
                handleDownload(attachment);
              }}
            >
              <div className="w-8 h-8 bg-blue-100 rounded-md flex items-center justify-center mb-1 group-hover:bg-blue-200 transition-colors">
                <span className="text-blue-600 text-[10px] font-semibold">
                  {attachment.file_type.toUpperCase().slice(0, 2) || 'F'}
                </span>
              </div>
              <p className="text-[10px] text-gray-800 text-center truncate w-full font-medium mb-0.5 leading-tight">
                {attachment.file_name}
              </p>
              <p className="text-[9px] text-gray-500 text-center leading-tight">
                {attachment.file_size}
              </p>
              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <DownloadOutlined className="text-blue-600 text-xs" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Newly Uploaded Files */}
      {uploadedFiles.length > 0 && (
        <div className={`mt-3 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2 ${existingAttachments.length > 0 ? 'pt-3 border-t border-gray-200' : ''}`}>
          {uploadedFiles.map((file, index) => (
            <div 
              key={index} 
              className="group relative aspect-square bg-gray-50 border border-gray-200 rounded-md p-2 hover:border-blue-300 hover:shadow-sm transition-all flex flex-col items-center justify-center"
            >
              <div className="w-8 h-8 bg-blue-100 rounded-md flex items-center justify-center mb-1 group-hover:bg-blue-200 transition-colors">
                <span className="text-blue-600 text-[10px] font-semibold">
                  {file.name.split('.').pop()?.toUpperCase().slice(0, 2) || 'F'}
                </span>
              </div>
              <p className="text-[10px] text-gray-800 text-center truncate w-full font-medium mb-0.5 leading-tight">
                {file.name}
              </p>
              <p className="text-[9px] text-gray-500 text-center leading-tight">
                {(file.size / 1024).toFixed(1)} KB
              </p>
              {!isReadOnly && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onFileRemove(index);
                  }}
                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700 text-sm font-bold w-4 h-4 flex items-center justify-center rounded-full hover:bg-red-50"
                  title="Remove"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {totalCount === 0 && (
        <div className="mt-3 text-[9px] text-gray-500 text-center py-2 bg-gray-50 rounded">
          No attachments yet
        </div>
      )}
    </div>
  );
};

export default AttachmentsSection;
