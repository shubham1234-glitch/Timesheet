import { getPredefinedEpics, getPredefinedEpicById } from '../models/predefinedEpicModel.js';

/**
 * Fetch all active predefined epics (for dropdown)
 */
export const fetchPredefinedEpics = async (req, res) => {
  try {
    const filters = req.query || {};

    const { predefinedEpics, total_count, error } = await getPredefinedEpics(filters);

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
        predefinedEpics,
        total_count,
      },
      message: `Retrieved ${total_count} predefined epics successfully`,
      status_code: 200,
      status_message: 'OK',
    });
  } catch (error) {
    console.error('❌ fetchPredefinedEpics controller error:', error.message);
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
 * Fetch single predefined epic by ID
 */
export const fetchPredefinedEpicById = async (req, res) => {
  try {
    const { predefined_epic_id } = req.params;
    const id = predefined_epic_id;

    const predefinedEpic = await getPredefinedEpicById(id);

    if (!predefinedEpic) {
      return res.status(404).json({
        success_flag: false,
        message: 'Predefined epic not found',
        status_code: 404,
        status_message: 'Not Found',
      });
    }

    return res.status(200).json({
      success_flag: true,
      data: { predefinedEpic },
      message: `Retrieved predefined epic ${id} successfully`,
      status_code: 200,
      status_message: 'OK',
    });
  } catch (error) {
    console.error('❌ fetchPredefinedEpicById controller error:', error.message);
    return res.status(500).json({
      success_flag: false,
      message: 'Unexpected server error',
      error: error.message,
      status_code: 500,
      status_message: 'Internal Server Error',
    });
  }
};

