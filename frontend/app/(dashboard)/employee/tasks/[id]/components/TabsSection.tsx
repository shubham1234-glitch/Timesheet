"use client";

import React, { useMemo } from 'react';
import { Tabs } from 'antd';
import dayjs from 'dayjs';
import { CommentOutlined, HistoryOutlined, InfoCircleOutlined, ExclamationCircleOutlined, StopOutlined } from '@ant-design/icons';
import ActivityTab from '@/app/components/shared/ActivityTab';
import CommentsTab from '@/app/components/shared/CommentsTab';
import type { Comment } from '@/app/components/shared/CommentsTab';
import { getStatusOptions } from '@/app/lib/masterData';
import { getMasterDataFromCache } from '@/app/lib/api';

interface TabsSectionProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  commentText: string;
  onCommentTextChange: (text: string) => void;
  onPostComment: () => void;
  comments: Comment[];
  isReadOnly?: boolean;
  status?: string;
  statusReason?: string;
  statusReasonsHistory?: Array<{ status_code?: string; status_reason?: string; created_at?: string; created_by?: string }>;
  taskId?: string;
}

const TabsSection: React.FC<TabsSectionProps> = ({
  activeTab,
  onTabChange,
  commentText,
  onCommentTextChange,
  onPostComment,
  comments,
  isReadOnly = false,
  status,
  statusReason,
  statusReasonsHistory = [],
  taskId,
}) => {
  // Always show Reason tab
  const showReasonTab = true;

  // Create a map of status codes to display names
  const statusCodeToName = useMemo(() => {
    const statusOptions = getStatusOptions();
    const map: Record<string, string> = {};
    statusOptions.forEach(opt => {
      map[opt.value] = opt.label;
    });
    return map;
  }, []);

  // Helper function to get user name from user code
  const getUserNameFromCode = (userCode: string | undefined | null): string => {
    if (!userCode) return '';
    // If it already looks like a name (contains space or is longer than typical codes), return as is
    if (userCode.includes(' ') || userCode.length > 10) {
      return userCode;
    }
    // Try to get from master data cache
    try {
      interface MasterDataCache {
        data?: {
          employees?: Array<{ user_name?: string; user_code?: string }>;
        };
      }
      const md = getMasterDataFromCache<MasterDataCache>();
      const employees = md?.data?.employees || [];
      const employee = employees.find((e) => e?.user_code === userCode);
      return employee?.user_name || userCode;
    } catch {
      return userCode;
    }
  };

  const tabs = [
    {
      key: "activity",
      label: (
        <span className="flex items-center gap-2">
          <HistoryOutlined />
          Activity
        </span>
      ),
      children: <ActivityTab entityType="task" active={activeTab === "activity"} />,
    },
    {
      key: "comments",
      label: (
        <span className="flex items-center gap-2">
          <CommentOutlined />
          Comments
        </span>
      ),
      children: (
        <CommentsTab
          commentText={commentText}
          onCommentTextChange={onCommentTextChange}
          onPostComment={onPostComment}
          comments={comments}
          isReadOnly={isReadOnly}
          entityType="task"
        />
      ),
    },
  ];

  // Add Reason tab, always visible, shows current reason and full history
  if (showReasonTab) {
    const currentStatus = (status || '').toLowerCase();

    // Determine visual state from current status or latest history entry
    const latestHist = Array.isArray(statusReasonsHistory) && statusReasonsHistory.length > 0 ? statusReasonsHistory[0] : undefined;
    const latestCode = String(latestHist?.status_code || '').toUpperCase();
    const mapCodeToKind = (code: string) => {
      // Heuristic mapping based on common codes
      if (code.includes('STS010') || code.includes('STS009')) return 'blocked';
      if (code.includes('STS005')) return 'onhold';
      return '';
    };
    const kindFromCode = mapCodeToKind(latestCode);

    const isOnHold = currentStatus.includes('on hold') || currentStatus.includes('hold') || kindFromCode === 'onhold';
    const isBlocked = currentStatus.includes('blocked') || currentStatus.includes('cancel') || kindFromCode === 'blocked';
    
    // Use colored styling if current status is On Hold or Blocked, otherwise use neutral styling
    const statusIcon = isOnHold ? <ExclamationCircleOutlined className="text-orange-500" /> : 
                       isBlocked ? <StopOutlined className="text-red-500" /> : 
                       <InfoCircleOutlined className="text-gray-500" />;
    const statusBgColor = isOnHold ? 'bg-orange-50' : isBlocked ? 'bg-red-50' : 'bg-gray-50';
    const statusBorderColor = isOnHold ? 'border-orange-200' : isBlocked ? 'border-red-200' : 'border-gray-200';
    const statusTextColor = isOnHold ? 'text-orange-700' : isBlocked ? 'text-red-700' : 'text-gray-700';
    
    tabs.push({
      key: "reason",
      label: (
        <span className="flex items-center gap-2">
          <InfoCircleOutlined />
          Reason
        </span>
      ),
      children: (
        <div className="mt-4">
          <div className={`${statusBgColor} ${statusBorderColor} border-l-4 rounded-lg p-4 shadow-sm`}>
            <div className="flex items-start gap-3 mb-3">
              <div className={`${statusTextColor} text-base flex-shrink-0 mt-0.5`}>
                {statusIcon}
              </div>
              <div className="flex-1">
                <h3 className={`text-xs font-semibold ${statusTextColor} mb-1`}>
                  {isOnHold ? 'Reason for On Hold' : isBlocked ? 'Reason for Blocked' : 'Status Reason'}
                </h3>
                <p className="text-[10px] text-gray-500">
                  {isOnHold 
                    ? 'This task has been put on hold. See the reason below.' 
                    : isBlocked
                    ? 'This task has been blocked. See the reason below.'
                    : 'This task previously had a status reason. See the reason below.'}
                </p>
              </div>
            </div>
            <div className={`bg-white rounded-md p-4 border ${statusBorderColor} shadow-inner`}>
              <div className="space-y-3">
                <div>
                  <div className="text-[10px] font-semibold text-gray-700 mb-1">Latest Reason</div>
                  {(() => {
                    // Filter to only get blocked status entries (STS010) that have a reason
                    const blockedHistory = Array.isArray(statusReasonsHistory) 
                      ? statusReasonsHistory.filter(r => {
                          const code = String(r.status_code || '').toUpperCase();
                          // Only show blocked status (STS010) entries that have a reason
                          return code.includes('STS010') && r.status_reason && r.status_reason.trim() && 
                                 !r.status_reason.toLowerCase().includes('task created') &&
                                 !r.status_reason.toLowerCase().includes('epic created');
                        })
                      : [];
                    
                    // Use the most recent blocked reason from history
                    const latestReason = blockedHistory.length > 0 
                      ? blockedHistory[0].status_reason 
                      : (statusReason && !statusReason.toLowerCase().includes('epic created') && !statusReason.toLowerCase().includes('task created') ? statusReason : null);
                    
                    return latestReason ? (
                      <p className="text-[11px] text-gray-800 whitespace-pre-wrap leading-relaxed">
                        {latestReason}
                      </p>
                    ) : (
                      <div className="flex items-center gap-2 text-gray-400">
                        <InfoCircleOutlined className="text-sm" />
                        <span className="text-[10px] italic">No reason provided</span>
                      </div>
                    );
                  })()}
                </div>

                <div>
                  <div className="text-[10px] font-semibold text-gray-700 mb-1">History</div>
                  {(() => {
                    // Filter to only show blocked status entries (STS010) that have a reason
                    const blockedHistory = Array.isArray(statusReasonsHistory) 
                      ? statusReasonsHistory.filter(r => {
                          const code = String(r.status_code || '').toUpperCase();
                          // Only show blocked status (STS010) entries that have a reason
                          return code.includes('STS010') && r.status_reason && r.status_reason.trim() && 
                                 !r.status_reason.toLowerCase().includes('task created') &&
                                 !r.status_reason.toLowerCase().includes('epic created');
                        })
                      : [];
                    
                    return blockedHistory.length > 0 ? (
                      <div className="space-y-2">
                        {blockedHistory.map((r, idx) => {
                          const code = String(r.status_code || '').toUpperCase();
                          const color = {
                            badge: 'bg-red-100 text-red-700 border border-red-200',
                            rail: 'border-red-200',
                            dot: 'bg-red-500'
                          };
                          return (
                            <div key={idx} className={`rounded-md bg-white shadow-sm border ${color.rail}`}>
                              <div className="flex items-start gap-3 p-2.5">
                                <div className={`h-2 w-2 rounded-full mt-1.5 ${color.dot}`} />
                                <div className="flex-1">
                                  <div className="flex items-center justify-between gap-2 mb-1">
                                    <div className="flex items-center gap-2">
                                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${color.badge}`}>
                                        Blocked
                                      </span>
                                      <span className="text-[9px] text-gray-500">
                                        {r.created_at ? dayjs(r.created_at).format('DD-MM-YYYY HH:mm') : 'N/A'}
                                      </span>
                                    </div>
                                    {r.created_by && (
                                      <span className="text-[9px] text-gray-500 italic">By {getUserNameFromCode(r.created_by)}</span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-gray-800 whitespace-pre-wrap leading-relaxed">
                                    {r.status_reason}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-[10px] text-gray-400">No previous reasons</div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
    });
  }

  return (
    <Tabs
      activeKey={activeTab}
      onChange={onTabChange}
      items={tabs}
      className="text-xs"
      size="small"
    />
  );
};

export default TabsSection;
