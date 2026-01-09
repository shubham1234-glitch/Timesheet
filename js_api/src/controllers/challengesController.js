import { getChallenges } from '../models/challengesModel.js';

export async function fetchChallenges(req, res) {
  try {
    const { parent_type, parent_code } = req.query;

    if (!parent_type || !parent_code) {
      return res
        .status(400)
        .json({ success_flag: false, message: 'parent_type and parent_code are required' });
    }

    const data = await getChallenges(String(parent_type).toUpperCase(), Number(parent_code));

    return res.status(200).json({
      success_flag: true,
      data,
      message: 'Challenges retrieved successfully',
      status_code: 200,
      status_message: 'OK',
    });
  } catch (error) {
    console.error('fetchChallenges error', error);
    return res
      .status(500)
      .json({ success_flag: false, message: 'Failed to fetch challenges' });
  }
}


