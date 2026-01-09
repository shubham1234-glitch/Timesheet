-- View: sts_ts.view_activities

-- DROP VIEW sts_ts.view_activities;

CREATE OR REPLACE VIEW sts_ts.view_activities
 AS
 SELECT a.id AS activity_id,
    a.activity_title,
    a.activity_description,
    a.product_code,
    pm.product_name,
    pm.version AS product_version,
    pm.product_desc AS product_description,
    a.is_billable,
    a.created_by,
    a.created_at,
    a.updated_by,
    a.updated_at,
    created_by_user.user_name AS created_by_name,
    created_by_user.first_name AS created_by_first_name,
    created_by_user.last_name AS created_by_last_name,
    created_by_user.email_id AS created_by_email,
    created_by_user.contact_num AS created_by_contact,
    created_by_user.designation_name AS created_by_designation,
    created_by_user.team_code AS created_by_team_code,
    created_by_team.team_name AS created_by_team_name,
    updated_by_user.user_name AS updated_by_name,
    updated_by_user.first_name AS updated_by_first_name,
    updated_by_user.last_name AS updated_by_last_name,
    updated_by_user.email_id AS updated_by_email,
    updated_by_user.contact_num AS updated_by_contact,
    updated_by_user.designation_name AS updated_by_designation,
    updated_by_user.team_code AS updated_by_team_code,
    updated_by_team.team_name AS updated_by_team_name,
    COALESCE(( SELECT json_agg(json_build_object('id', att.id, 'file_name', att.file_name, 'file_path', att.file_path, 'file_url', att.file_url, 'file_type', att.file_type, 'file_size', att.file_size, 'purpose', att.purpose, 'created_by', att.created_by, 'created_at', att.created_at) ORDER BY att.created_at DESC) AS json_agg
           FROM attachments att
          WHERE att.parent_type::text = 'ACTIVITY'::text AND att.parent_code = a.id), '[]'::json) AS attachments,
    ( SELECT count(*) AS count
           FROM attachments att
          WHERE att.parent_type::text = 'ACTIVITY'::text AND att.parent_code = a.id) AS attachments_count
   FROM activities a
     LEFT JOIN sts_new.product_master pm ON a.product_code::text = pm.product_code::text
     LEFT JOIN sts_new.user_master created_by_user ON a.created_by::text = created_by_user.user_code::text
     LEFT JOIN sts_new.team_master created_by_team ON created_by_user.team_code::text = created_by_team.team_code::text
     LEFT JOIN sts_new.user_master updated_by_user ON a.updated_by::text = updated_by_user.user_code::text
     LEFT JOIN sts_new.team_master updated_by_team ON updated_by_user.team_code::text = updated_by_team.team_code::text;

ALTER TABLE sts_ts.view_activities
    OWNER TO sts_ts;
COMMENT ON VIEW sts_ts.view_activities
    IS 'Comprehensive view showing all activities with related product, user, and attachment information. Includes attachments as JSON array.';

GRANT ALL ON TABLE sts_ts.view_activities TO sts_ts;
GRANT SELECT ON TABLE sts_ts.view_activities TO sukraa_analyst;
GRANT SELECT ON TABLE sts_ts.view_activities TO sukraa_dev;

