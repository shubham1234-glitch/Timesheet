"use client";

import React, { useMemo } from 'react';
import { Tabs } from 'antd';
import dayjs from 'dayjs';
import { CommentOutlined, HistoryOutlined, InfoCircleOutlined, ExclamationCircleOutlined, StopOutlined, WarningOutlined } from '@ant-design/icons';
import ActivityTab from '@/app/components/shared/ActivityTab';
import CommentsTab from '@/app/components/shared/CommentsTab';
import type { Comment } from '@/app/components/shared/CommentsTab';
import { getStatusOptions } from '@/app/lib/masterData';

interface EpicTabsSectionProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  commentText: string;
  onCommentTextChange: (text: string) => void;
  onPostComment: () => void;
  comments: Comment[];
  challenges?: Comment[]; // Separate challenges list
  isReadOnly?: boolean;
  status?: string;
  statusReason?: string;
  statusReasonsHistory?: Array<{ status_code?: string; status_reason?: string; created_at?: string; created_by?: string }>;
  onPostChallenge?: () => void; // Handler for posting challenges
}

const EpicTabsSection: React.FC<EpicTabsSectionProps> = ({
  activeTab,
  onTabChange,
  commentText,
  onCommentTextChange,
  onPostComment,
  comments,
  challenges = [],
  isReadOnly = false,
  status,
  statusReason,
  statusReasonsHistory = [],
  onPostChallenge,
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

  const tabs = [
    {
      key: "activity",
      label: (
        <span className="flex items-center gap-2">
          <HistoryOutlined />
          Activity
        </span>
      ),
      children: <ActivityTab entityType="epic" active={activeTab === "activity"} />,
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
          entityType="epic"
        />
      ),
    },
    {
      key: "challenges",
      label: (
        <span className="flex items-center gap-2">
          <WarningOutlined />
          Challenges
        </span>
      ),
      children: (
        <CommentsTab
          commentText={commentText}
          onCommentTextChange={onCommentTextChange}
          onPostComment={onPostComment}
          comments={challenges}
          isReadOnly={isReadOnly}
          entityType="epic"
          mode="challenges"
          onPostChallenge={onPostChallenge}
        />
      ),
    },
  ];

  // Add Reason tab if statusReason exists (persists even when status changes)
  if (showReasonTab) {
    const currentStatus = (status || '').toLowerCase();

    // Determine visual state from current status or latest history entry
    const latestHist = Array.isArray(statusReasonsHistory) && statusReasonsHistory.length > 0 ? statusReasonsHistory[0] : undefined as any;
    const latestCode = String(latestHist?.status_code || '').toUpperCase();
    const mapCodeToKind = (code: string) => {
      if (code.includes('STS010') || code.includes('STS009')) return 'blocked';
      if (code.includes('STS005')) return 'onhold';
      return '';
    };
    const kindFromCode = mapCodeToKind(latestCode);

    const isOnHold = currentStatus.includes('on hold') || currentStatus.includes('hold') || kindFromCode === 'onhold';
    const isBlocked = currentStatus.includes('blocked') || currentStatus.includes('cancel') || kindFromCode === 'blocked';
    
    // Use colored styling if current/last status is On Hold or Blocked, otherwise use neutral styling
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
                  {isOnHold ? 'Reason for On Hold' : isBlocked ? 'Reason for Blocked/Cancelled' : 'Status Reason'}
                </h3>
                <p className="text-[10px] text-gray-500">
                  {isOnHold 
                    ? 'This epic has been put on hold. See the reason below.' 
                    : isBlocked
                    ? 'This epic has been blocked or cancelled. See the reason below.'
                    : 'This epic previously had a status reason. See the reason below.'}
                </p>
              </div>
            </div>
            <div className={`bg-white rounded-md p-4 border ${statusBorderColor} shadow-inner`}>
              <div className="space-y-3">
                <div>
                  <div className="text-[10px] font-semibold text-gray-700 mb-1">Latest Reason</div>
                  {statusReason ? (
                    <p className="text-[11px] text-gray-800 whitespace-pre-wrap leading-relaxed">
                      {statusReason}
                    </p>
                  ) : (
                    <div className="flex items-center gap-2 text-gray-400">
                      <InfoCircleOutlined className="text-sm" />
                      <span className="text-[10px] italic">No reason provided</span>
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-[10px] font-semibold text-gray-700 mb-1">History</div>
                  {Array.isArray(statusReasonsHistory) && statusReasonsHistory.length > 0 ? (
                    <div className="space-y-2">
                      {statusReasonsHistory.map((r, idx) => {
                        const code = String(r.status_code || '').toUpperCase();
                        const kind = code.includes('STS010') || code.includes('STS009') ? 'blocked' : code.includes('STS005') ? 'onhold' : 'neutral';
                        const color = kind === 'blocked' ? {
                          badge: 'bg-red-100 text-red-700 border border-red-200',
                          rail: 'border-red-200',
                          dot: 'bg-red-500'
                        } : kind === 'onhold' ? {
                          badge: 'bg-orange-100 text-orange-700 border border-orange-200',
                          rail: 'border-orange-200',
                          dot: 'bg-orange-500'
                        } : {
                          badge: 'bg-gray-100 text-gray-700 border border-gray-200',
                          rail: 'border-gray-200',
                          dot: 'bg-gray-400'
                        };
                        return (
                          <div key={idx} className={`rounded-md bg-white shadow-sm border ${color.rail}`}>
                            <div className="flex items-start gap-3 p-2.5">
                              <div className={`h-2 w-2 rounded-full mt-1.5 ${color.dot}`} />
                              <div className="flex-1">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${color.badge}`}>
                                      {statusCodeToName[r.status_code || ''] || (code || '').replace(/^STS/i, '')}
                                    </span>
                                    <span className="text-[9px] text-gray-500">
                                      {r.created_at ? dayjs(r.created_at).format('DD-MM-YYYY HH:mm') : 'N/A'}
                                    </span>
                                  </div>
                                  {r.created_by && (
                                    <span className="text-[9px] text-gray-500 italic">By {r.created_by}</span>
                                  )}
                                </div>
                                <div className="text-[10px] text-gray-800 whitespace-pre-wrap leading-relaxed">
                                  {r.status_reason || '-'}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-[10px] text-gray-400">No previous reasons</div>
                  )}
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

export default EpicTabsSection;

