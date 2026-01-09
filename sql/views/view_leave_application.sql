-- View: sts_ts.view_leave_application

-- DROP VIEW sts_ts.view_leave_application;

CREATE OR REPLACE VIEW sts_ts.view_leave_application
 AS
 SELECT la.id AS leave_application_id,
    la.user_code,
    la.leave_type_code,
    la.from_date,
    la.to_date,
    la.duration_days,
    la.duration_hours,
    la.reason,
    la.approval_status,
    la.created_at AS leave_created_at,
    la.updated_at AS leave_updated_at,
    um_applicant.user_name AS applicant_name,
    um_applicant.first_name AS applicant_first_name,
    um_applicant.last_name AS applicant_last_name,
    um_applicant.email_id AS applicant_email,
    um_applicant.contact_num AS applicant_contact,
    um_applicant.designation_name AS applicant_designation,
    um_applicant.team_code AS applicant_team_code,
    tm_applicant.team_name AS applicant_team_name,
    tm_applicant.team_lead AS applicant_team_lead,
    tm_applicant.reporter AS applicant_reporter,
    ltm.leave_type_name,
    ltm.leave_type_description,
        CASE
            WHEN la.leave_type_code::text = 'LT005'::text THEN true
            ELSE false
        END AS is_permission,
    la.approved_by,
    um_approver.user_name AS approved_by_name,
    la.approved_at,
    la.rejected_by,
    um_rejector.user_name AS rejected_by_name,
    la.rejected_at,
    la.rejection_reason,
    la.created_by,
    um_creator.user_name AS created_by_name,
    la.updated_by,
    um_updater.user_name AS updated_by_name,
    COALESCE(( SELECT json_agg(json_build_object('id', a.id, 'file_name', a.file_name, 'file_path', a.file_path, 'file_url', a.file_url, 'file_type', a.file_type, 'file_size', a.file_size, 'purpose', a.purpose, 'created_at', a.created_at) ORDER BY a.created_at) AS json_agg
           FROM attachments a
          WHERE a.parent_type::text = 'LEAVE_APPLICATION'::text AND a.parent_code = la.id), '[]'::json) AS attachments
   FROM leave_application la
     JOIN sts_new.user_master um_applicant ON la.user_code::text = um_applicant.user_code::text
     LEFT JOIN sts_new.team_master tm_applicant ON um_applicant.team_code::text = tm_applicant.team_code::text
     JOIN leave_type_master ltm ON la.leave_type_code::text = ltm.leave_type_code::text
     LEFT JOIN sts_new.user_master um_approver ON la.approved_by::text = um_approver.user_code::text
     LEFT JOIN sts_new.user_master um_rejector ON la.rejected_by::text = um_rejector.user_code::text
     LEFT JOIN sts_new.user_master um_creator ON la.created_by::text = um_creator.user_code::text
     LEFT JOIN sts_new.user_master um_updater ON la.updated_by::text = um_updater.user_code::text
  ORDER BY la.created_at DESC;

ALTER TABLE sts_ts.view_leave_application
    OWNER TO sts_ts;
COMMENT ON VIEW sts_ts.view_leave_application
    IS 'Comprehensive view for leave applications with applicant details, leave type information, approval details, and attachments. Use this view to fetch leave application data with all related information.';

GRANT ALL ON TABLE sts_ts.view_leave_application TO sts_ts;
GRANT SELECT ON TABLE sts_ts.view_leave_application TO sukraa_analyst;
GRANT SELECT ON TABLE sts_ts.view_leave_application TO sukraa_dev;

