import { pool } from '../config/db.js';

export async function getComments(parentType, parentCode) {
  const params = [];
  let where = 'WHERE 1=1';
  if (parentType) {
    params.push(parentType);
    where += ` AND parent_type = $${params.length}`;
  }
  if (parentCode) {
    params.push(Number(parentCode));
    where += ` AND parent_code = $${params.length}`;
  }

  const query = `
    SELECT 
      comment_id,
      parent_type,
      parent_code,
      comment_text,
      commented_by,
      commented_by_name,
      commented_at,
      updated_by,
      updated_at
    FROM sts_ts.view_comments
    ${where}
    ORDER BY commented_at ASC, comment_id ASC;
  `;

  const { rows } = await pool.query(query, params);
  return rows.map(r => ({
    id: r.comment_id,
    parent_type: r.parent_type,
    parent_code: r.parent_code,
    text: r.comment_text,
    author_code: r.commented_by,
    author_name: r.commented_by_name || r.commented_by,
    commented_at: r.commented_at,
    updated_by: r.updated_by,
    updated_at: r.updated_at,
  }));
}


