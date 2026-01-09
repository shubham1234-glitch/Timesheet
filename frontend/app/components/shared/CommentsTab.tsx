import React, { useState, useMemo } from 'react';

export interface Comment {
  text: string;
  author: string;
  date: string;
}

interface CommentsTabProps {
  commentText: string;
  onCommentTextChange: (text: string) => void;
  onPostComment: () => void;
  comments: Comment[] | string[]; // Support both old format (string[]) and new format (Comment[])
  isReadOnly?: boolean;
  entityType?: 'task' | 'epic';
  // When mode is "challenges", we reuse this component for Challenges UI
  mode?: 'comments' | 'challenges';
  // Optional separate handler for challenges (if not provided, uses onPostComment)
  onPostChallenge?: () => void;
}

const CommentsTab: React.FC<CommentsTabProps> = ({
  commentText,
  onCommentTextChange,
  onPostComment,
  comments,
  isReadOnly = false,
  entityType = 'task',
  mode = 'comments',
  onPostChallenge,
}) => {
  const [expanded, setExpanded] = useState(false);
  const visibleComments = useMemo(() => {
    const list = Array.isArray(comments) ? comments : [];
    return expanded ? list : list.slice(0, 2);
  }, [comments, expanded]);

  const isChallenges = mode === 'challenges';

  const emptyStateText = isChallenges
    ? 'No challenges recorded yet. Describe the challenges you faced while completing this work.'
    : 'No comments yet. Be the first to comment!';

  const textareaPlaceholder = isChallenges
    ? 'Describe the challenges you faced while completing this epic or task...'
    : 'Add a comment...';

  const buttonLabel = isChallenges ? 'Add Challenge' : 'Post Comment';

  return (
    <div className="space-y-3">
      {visibleComments.map((comment, index) => {
        // Support both old format (string) and new format (Comment object)
        const commentObj: Comment = typeof comment === 'string' 
          ? { text: comment, author: 'User', date: new Date().toLocaleDateString() }
          : comment;
        
        const authorInitial = commentObj.author.charAt(0).toUpperCase();
        
        return (
          <div key={index} className="bg-gray-50 p-3 rounded-md">
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-medium">
                {authorInitial}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-gray-700">{commentObj.author}</span>
                  <span className="text-xs text-gray-500">
                    {commentObj.date}
                  </span>
                </div>
                <p className="text-xs text-gray-800">{commentObj.text}</p>
              </div>
            </div>
          </div>
        );
      })}
      {comments.length === 0 && (
        <p className="text-xs text-gray-500 text-center py-4">
          {emptyStateText}
        </p>
      )}
      {comments.length > 2 && (
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
      {!isReadOnly && (
        <div className="mt-4">
          <textarea
            value={commentText}
            onChange={(e) => onCommentTextChange(e.target.value)}
            placeholder={textareaPlaceholder}
            className="w-full p-2 border border-gray-300 rounded text-xs resize-none focus:outline-none focus:ring-1 focus:ring-blue-300"
            rows={3}
          />
          <button
            onClick={isChallenges && onPostChallenge ? onPostChallenge : onPostComment}
            disabled={!commentText.trim()}
            className="mt-2 px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {buttonLabel}
          </button>
        </div>
      )}
    </div>
  );
};

export default CommentsTab;

