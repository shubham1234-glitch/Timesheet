import React from 'react';

interface CommentsTabProps {
  commentText: string;
  onCommentTextChange: (text: string) => void;
  onPostComment: () => void;
  comments: string[];
  isReadOnly?: boolean;
}

const CommentsTab: React.FC<CommentsTabProps> = ({
  commentText,
  onCommentTextChange,
  onPostComment,
  comments,
  isReadOnly = false,
}) => {
  return (
    <div className="p-3">
      {/* Comment Input - Always available for commenting */}
      <div className="mb-4 border border-gray-300 rounded-md p-2 focus-within:ring-1 focus-within:ring-blue-300">
        <textarea
          value={commentText}
          onChange={(e) => onCommentTextChange(e.target.value)}
          placeholder="Write a comment..."
          className="w-full border-none outline-none text-xs resize-none bg-transparent"
          rows={2}
        />
        <div className="flex justify-end mt-2">
          <button
            onClick={onPostComment}
            disabled={!commentText.trim()}
            className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            Post Comment
          </button>
        </div>
      </div>
      
      {/* Comments List */}
      <div className="space-y-3">
        {comments.length === 0 ? (
          <p className="text-gray-500 text-xs">No comments yet. Be the first to comment!</p>
        ) : (
          comments.map((comment, index) => (
            <div key={index} className="bg-gray-50 p-3 rounded-md">
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-medium">
                  U
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-gray-700">User</span>
                    <span className="text-xs text-gray-500">
                      {new Date().toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs text-gray-800">{comment}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CommentsTab;
