import { getComments } from '../models/commentsModel.js';

export async function fetchComments(req, res) {
  try {
    const { parent_type, parent_code } = req.query;
    if (!parent_type || !parent_code) {
      return res.status(400).json({ success_flag: false, message: 'parent_type and parent_code are required' });
    }

    const data = await getComments(String(parent_type).toUpperCase(), Number(parent_code));
    return res.status(200).json({ success_flag: true, data, message: 'Comments retrieved successfully', status_code: 200, status_message: 'OK' });
  } catch (error) {
    console.error('fetchComments error', error);
    return res.status(500).json({ success_flag: false, message: 'Failed to fetch comments' });
  }
}


