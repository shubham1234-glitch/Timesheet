import { getEpics, getEpicById } from '../models/epicModel.js';

/**
 * Fetch all epics (with tasks grouped inside)
 */
export const fetchEpics = async (req, res) => {
  try {
    const filters = req.query || {};
    const limit = parseInt(req.query.limit, 10) || 100;
    const offset = parseInt(req.query.offset, 10) || 0;

    const { epics, total_count, error } = await getEpics(filters, limit, offset);

    if (error) {
      return res.status(500).json({
        success_flag: false,
        message: 'Database query failed',
        error,
        status_code: 500,
        status_message: 'Internal Server Error',
      });
    }

    return res.status(200).json({
      success_flag: true,
      data: {
        epics,
        pagination: {
          total_count,
          limit,
          offset,
          has_more: total_count > limit + offset,
        },
      },
      message: `Retrieved ${total_count} epics successfully`,
      status_code: 200,
      status_message: 'OK',
    });
  } catch (error) {
    console.error('❌ fetchEpics controller error:', error.message);
    return res.status(500).json({
      success_flag: false,
      message: 'Unexpected server error',
      error: error.message,
      status_code: 500,
      status_message: 'Internal Server Error',
    });
  }
};

/**
 * Fetch single epic by ID
 */
export const fetchEpicById = async (req, res) => {
  try {
    const { epic_id } = req.params;
    const id = epic_id;

    const epic = await getEpicById(id);

    if (!epic) {
      return res.status(404).json({
        success_flag: false,
        message: 'Epic not found',
        status_code: 404,
        status_message: 'Not Found',
      });
    }

    return res.status(200).json({
      success_flag: true,
      data: { epic },
      message: `Retrieved epic ${id} successfully`,
      status_code: 200,
      status_message: 'OK',
    });
  } catch (error) {
    console.error('❌ fetchEpicById controller error:', error.message);
    return res.status(500).json({
      success_flag: false,
      message: 'Unexpected server error',
      error: error.message,
      status_code: 500,
      status_message: 'Internal Server Error',
    });
  }
};
