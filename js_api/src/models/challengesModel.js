import { pool } from '../config/db.js';

export async function getChallenges(parentType, parentCode) {
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
      challenge_id,
      parent_type,
      parent_code,
      challenge_title,
      challenge_description,
      created_by,
      created_by_name,
      created_at,
      updated_by,
      updated_by_name,
      updated_at
    FROM sts_ts.view_challenges
    ${where}
    ORDER BY created_at ASC, challenge_id ASC;
  `;

  const { rows } = await pool.query(query, params);

  return rows.map((r) => ({
    id: r.challenge_id,
    parent_type: r.parent_type,
    parent_code: r.parent_code,
    title: r.challenge_title,
    description: r.challenge_description,
    created_by: r.created_by,
    created_by_name: r.created_by_name || r.created_by,
    created_at: r.created_at,
    updated_by: r.updated_by,
    updated_by_name: r.updated_by_name || r.updated_by,
    updated_at: r.updated_at,
  }));
}


