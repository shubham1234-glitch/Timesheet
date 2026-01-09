import { pool } from '../config/db.js';
import { config } from '../config/env.js';

export async function getActivities(parentType, parentCode, limit = 100, offset = 0) {
  const type = String(parentType || '').toUpperCase();
  const code = Number(parentCode);
  if (!code || (type !== 'EPIC' && type !== 'TASK')) {
    throw new Error('Invalid parameters');
  }

  const params = [];
  let where = 'WHERE 1=1';

  if (type === 'EPIC') {
    params.push(code);
    where += ` AND epic_code = $${params.length}`;
  } else if (type === 'TASK') {
    params.push('TASK');
    where += ` AND entity_type = $${params.length}`;
    params.push(code);
    where += ` AND entity_code = $${params.length}`;
  }

  params.push(limit);
  params.push(offset);

  const query = `
    SELECT
      epic_code,
      epic_title,
      epic_description,
      activity_type,
      entity_code,
      entity_type,
      status_desc,
      assignee,
      created_at,
      created_by,
      activity_description,
      entity_title,
      entity_description,
      task_id,
      task_title,
      created_by_name,
      assignee_name,
      formatted_time,
      time_ago
    FROM sts_ts.view_recent_activities
    ${where}
    ORDER BY created_at DESC
    LIMIT $${params.length - 1} OFFSET $${params.length};
  `;

  const { rows } = await pool.query(query, params);
  return rows;
}

/**
 * Get outdoor activities from view_activities with optional filters
 */
export async function getOutdoorActivities(filters = {}, limit = 100, offset = 0) {
  const whereConditions = [];
  const params = [];

  const {
    product_code,
    is_billable,
    created_by,
    created_at_from,
    created_at_to,
  } = filters;

  if (product_code) {
    whereConditions.push(`product_code = $${params.length + 1}`);
    params.push(product_code);
  }
  if (is_billable !== undefined && is_billable !== null) {
    whereConditions.push(`is_billable = $${params.length + 1}`);
    params.push(is_billable);
  }
  if (created_by) {
    whereConditions.push(`created_by = $${params.length + 1}`);
    params.push(created_by);
  }
  if (created_at_from) {
    whereConditions.push(`DATE(created_at) >= $${params.length + 1}`);
    params.push(created_at_from);
  }
  if (created_at_to) {
    whereConditions.push(`DATE(created_at) <= $${params.length + 1}`);
    params.push(created_at_to);
  }

  const whereClause = whereConditions.length > 0 
    ? `WHERE ${whereConditions.join(' AND ')}` 
    : '';

  const query = `
    SELECT 
      activity_id,
      activity_title,
      activity_description,
      product_code,
      product_name,
      product_version,
      product_description,
      is_billable,
      created_by,
      created_at,
      updated_by,
      updated_at,
      created_by_name,
      created_by_first_name,
      created_by_last_name,
      created_by_email,
      created_by_contact,
      created_by_designation,
      created_by_team_code,
      created_by_team_name,
      updated_by_name,
      updated_by_first_name,
      updated_by_last_name,
      updated_by_email,
      updated_by_contact,
      updated_by_designation,
      updated_by_team_code,
      updated_by_team_name,
      attachments,
      attachments_count
    FROM sts_ts.view_activities
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2};
  `;

  params.push(limit, offset);

  const { rows } = await pool.query(query, params);

  // Process attachments and construct file URLs
  const activities = rows.map((row) => {
    let attachments = [];
    try {
      if (row.attachments) {
        if (typeof row.attachments === 'string') {
          attachments = JSON.parse(row.attachments);
        } else {
          attachments = row.attachments;
        }
      }

      // Construct file_url for each attachment
      attachments = attachments.map((att) => {
        const fileNameFromPath = att.file_path ? att.file_path.split('/').pop() : '';
        const fileServerBase = config.FILE_SERVER_BASE_URL;
        let fileUrl = '';

        if (fileServerBase && fileNameFromPath) {
          const baseUrl = fileServerBase.endsWith('/') ? fileServerBase : `${fileServerBase}/`;
          fileUrl = `${baseUrl}${fileNameFromPath}`;
        }

        return {
          ...att,
          file_url: fileUrl || att.file_url || '',
        };
      });
    } catch (error) {
      console.error('Error processing activity attachments:', error.message);
      attachments = [];
    }

    return {
      ...row,
      attachments,
      attachments_count: row.attachments_count || attachments.length,
    };
  });

  // Get total count for pagination
  const countQuery = `
    SELECT COUNT(*) 
    FROM sts_ts.view_activities
    ${whereClause}
  `;
  const countResult = await pool.query(countQuery, params.slice(0, -2));

  return {
    activities,
    total_count: Number(countResult.rows[0].count),
  };
}


