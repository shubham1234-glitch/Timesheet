import { getActivities, getOutdoorActivities } from '../models/activityModel.js';

export async function fetchActivity(req, res) {
  try {
    const { parent_type, parent_code, limit, offset } = req.query;
    if (!parent_type || !parent_code) {
      return res.status(400).json({ success_flag: false, message: 'parent_type and parent_code are required' });
    }
    const items = await getActivities(parent_type, parent_code, Number(limit) || 100, Number(offset) || 0);
    return res.status(200).json({ success_flag: true, data: items, message: 'Activities retrieved successfully', status_code: 200, status_message: 'OK' });
  } catch (error) {
    console.error('fetchActivity error', error);
    return res.status(500).json({ success_flag: false, message: 'Failed to fetch activities' });
  }
}

export async function fetchOutdoorActivities(req, res) {
  try {
    const {
      product_code,
      is_billable,
      created_by,
      created_at_from,
      created_at_to,
      limit,
      offset,
    } = req.query;

    const filters = {};
    if (product_code) filters.product_code = product_code;
    if (is_billable !== undefined) {
      filters.is_billable = is_billable === 'true' || is_billable === true;
    }
    if (created_by) filters.created_by = created_by;
    if (created_at_from) filters.created_at_from = created_at_from;
    if (created_at_to) filters.created_at_to = created_at_to;

    const result = await getOutdoorActivities(
      filters,
      Number(limit) || 100,
      Number(offset) || 0
    );

    return res.status(200).json({
      success_flag: true,
      data: result.activities,
      total_count: result.total_count,
      message: 'Outdoor activities retrieved successfully',
      status_code: 200,
      status_message: 'OK',
    });
  } catch (error) {
    console.error('fetchOutdoorActivities error', error);
    return res.status(500).json({
      success_flag: false,
      message: 'Failed to fetch outdoor activities',
      error: error.message,
    });
  }
}


