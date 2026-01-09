import React, { useEffect, useState } from 'react';
import { apiRequest } from '@/app/lib/api';
import { useParams } from 'next/navigation';

interface ActivityTabProps {
  entityType?: 'task' | 'epic';
  active?: boolean; // When true, indicates the tab is active and should refresh
}

type ActivityItem = {
  activity_type: string;
  entity_type: string;
  status_desc: string;
  activity_description: string;
  created_by_name: string;
  assignee_name: string | null;
  formatted_time: string;
};

// Helper function to get initials from a name
const getInitials = (name: string): string => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

// Helper function to get a color based on name (for consistent avatar colors)
const getAvatarColor = (name: string): string => {
  if (!name) return 'bg-gray-400';
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-yellow-500',
    'bg-red-500',
    'bg-teal-500',
    'bg-orange-500',
    'bg-cyan-500',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const ActivityTab: React.FC<ActivityTabProps> = ({ entityType = 'task', active = false }) => {
  const params = useParams<{ id: string }>();
  const rawId = params?.id || '';
  const parentCode = entityType === 'task' ? Number(String(rawId).replace(/^(TA-|TASK-|TSK-)/i, '')) : Number(rawId);
  const parentType = entityType === 'task' ? 'TASK' : 'EPIC';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const fetchActivities = async () => {
      if (!parentCode) return;
      setLoading(true);
      setError('');
      try {
        interface ActivityApiResponse {
          success_flag: boolean;
          data: ActivityItem[];
        }
        const qs = new URLSearchParams({ parent_type: parentType, parent_code: String(parentCode), limit: '50', offset: '0' }).toString();
        const resp = await apiRequest<ActivityApiResponse>(`get_activity?${qs}`, 'GET');
        const data = Array.isArray(resp?.data) ? resp.data : [];
        setItems(data);
      } catch (e: unknown) {
        const errorMessage = (e instanceof Error ? e.message : 'Failed to load activities');
        setError(errorMessage);
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    fetchActivities();
  }, [parentCode, parentType, active]); // Added 'active' to dependencies to refetch when tab becomes active

  return (
    <div className="text-xs text-gray-600 py-2 space-y-2">
      {loading && <p className="text-gray-500">Loading activities...</p>}
      {!loading && error && <p className="text-red-600">{error}</p>}
      {!loading && !error && items.length === 0 && <p className="text-gray-500">No recent activity.</p>}
      {!loading && !error && items.length > 0 && (
        <ul className="space-y-2">
          {(expanded ? items : items.slice(0, 2)).map((a: ActivityItem, idx: number) => {
            const responsibleName = a.created_by_name || 'System';
            const initials = getInitials(responsibleName);
            const avatarColor = getAvatarColor(responsibleName);
            
            return (
              <li key={idx} className="bg-gray-50 rounded p-2">
                <div className="flex items-start gap-3">
                  {/* Profile Avatar with Initials */}
                  <div className={`${avatarColor} rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0`}>
                    <span className="text-white text-[10px] font-semibold">{initials}</span>
                  </div>
                  
                  {/* Activity Content */}
                  <div className="flex-1 min-w-0">
                    <div className="text-gray-700 text-[12px]">{a.activity_description || a.status_desc || a.activity_type}</div>
                    <div className="text-gray-500 text-[11px] mt-1 flex items-center gap-2">
                      {a.created_by_name && <span>{a.created_by_name}</span>}
                      {a.formatted_time && (
                        <>
                          {a.created_by_name && <span>•</span>}
                          <span>{a.formatted_time}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {!loading && !error && items.length > 2 && (
        <div className="text-center">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-blue-600 hover:text-blue-800 text-xs underline"
            type="button"
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        </div>
      )}
    </div>
  );
};

export default ActivityTab;

