-- View: sts_ts.view_unified_epic_task

-- DROP VIEW sts_ts.view_unified_epic_task;

CREATE OR REPLACE VIEW sts_ts.view_unified_epic_task
 AS
 SELECT e.id AS epic_id,
    e.epic_title,
    e.epic_description,
    COALESCE(eh_latest.product_code, e.product_code) AS product_code,
    e.company_code,
    e.contact_person_code,
    COALESCE(eh_latest.reporter, e.reporter) AS reporter,
    COALESCE(eh_latest.status_code, e.status_code) AS status_code,
    COALESCE(eh_latest.priority_code, e.priority_code) AS priority_code,
    COALESCE(eh_latest.start_date, e.start_date) AS start_date,
    COALESCE(eh_latest.due_date, e.due_date) AS due_date,
    COALESCE(eh_latest.closed_on, e.closed_on) AS closed_on,
    COALESCE(eh_latest.estimated_hours, e.estimated_hours) AS estimated_hours,
    COALESCE(eh_latest.estimated_days, e.estimated_days) AS estimated_days,
    e.is_billable,
    COALESCE(eh_latest.cancelled_by, e.cancelled_by) AS cancelled_by,
    COALESCE(eh_latest.cancelled_at, e.cancelled_at) AS cancelled_at,
    COALESCE(eh_latest.status_reason, e.cancellation_reason) AS cancellation_reason,
    e.created_by AS epic_created_by,
    e.created_at AS epic_created_at,
    e.updated_by AS epic_updated_by,
    e.updated_at AS epic_updated_at,
    pm.product_name,
    pm.version AS product_version,
    pm.product_desc AS product_description,
    cm.company_name,
    cpm.full_name AS contact_person_name,
    cpm.email_id AS contact_person_email,
    cpm.contact_num AS contact_person_phone,
    s.status_desc AS status_description,
    pr.priority_desc AS priority_description,
    cancelled_by_user.user_name AS cancelled_by_name,
    reporter_epic_user.user_name AS reporter_name,
    created_by_epic_user.user_name AS epic_created_by_name,
    updated_by_epic_user.user_name AS epic_updated_by_name,
    COALESCE(eh_latest.status_reason, NULL::text) AS status_reason,
    COALESCE(( SELECT json_agg(json_build_object('status_code', eh_all.status_code, 'status_reason', eh_all.status_reason, 'created_at', eh_all.created_at, 'created_by', eh_all.created_by, 'created_by_name', um_epic_hist.user_name) ORDER BY eh_all.created_at DESC) AS json_agg
           FROM epic_hist eh_all
             LEFT JOIN sts_new.user_master um_epic_hist ON eh_all.created_by::text = um_epic_hist.user_code::text
          WHERE eh_all.epic_code = e.id AND eh_all.status_reason IS NOT NULL), '[]'::json) AS all_status_reasons,
    COALESCE(task_stats.task_count, 0::bigint) AS epic_task_count,
    COALESCE(task_stats.total_task_estimated_hours, 0::numeric) AS total_task_estimated_hours,
    COALESCE(task_stats.total_task_estimated_days, 0::numeric) AS total_task_estimated_days,
    COALESCE(( SELECT json_agg(json_build_object('id', a.id, 'file_name', a.file_name, 'file_path', a.file_path, 'file_url', a.file_url, 'file_type', a.file_type, 'file_size', a.file_size, 'purpose', a.purpose, 'created_by', a.created_by, 'created_at', a.created_at) ORDER BY a.created_at DESC) AS json_agg
           FROM attachments a
          WHERE a.parent_type::text = 'EPIC'::text AND a.parent_code = e.id), '[]'::json) AS epic_attachments,
    ( SELECT count(*) AS count
           FROM attachments a
          WHERE a.parent_type::text = 'EPIC'::text AND a.parent_code = e.id) AS epic_attachments_count,
    t.id AS task_id,
    t.task_title,
    t.description AS task_description,
    t.epic_code AS task_epic_code,
    COALESCE(th_latest.status_code, t.status_code) AS task_status_code,
    s_task.status_desc AS task_status_description,
    COALESCE(th_latest.status_reason, NULL::text) AS task_status_reason,
    COALESCE(( SELECT json_agg(json_build_object('status_code', th_all.status_code, 'status_reason', th_all.status_reason, 'created_at', th_all.created_at, 'created_by', th_all.created_by, 'created_by_name', um_task_hist.user_name) ORDER BY th_all.created_at DESC) AS json_agg
           FROM task_hist th_all
             LEFT JOIN sts_new.user_master um_task_hist ON th_all.created_by::text = um_task_hist.user_code::text
          WHERE th_all.task_code = t.id AND th_all.status_reason IS NOT NULL), '[]'::json) AS task_all_status_reasons,
    COALESCE(th_latest.priority_code, t.priority_code) AS task_priority_code,
    pr_task.priority_desc AS task_priority_description,
    COALESCE(th_latest.task_type_code, t.task_type_code) AS task_type_code,
    COALESCE(th_latest.work_mode, t.work_mode) AS task_work_mode,
    COALESCE(th_latest.product_code, t.product_code) AS task_product_code,
    COALESCE(th_latest.assigned_team_code, t.assigned_team_code, assignee_user.team_code) AS task_team_code,
    assigned_team.team_name AS task_assigned_team_name,
    COALESCE(th_latest.assignee, t.assignee) AS task_assignee,
    assignee_user.user_name AS task_assignee_name,
    COALESCE(th_latest.reporter, t.reporter) AS task_reporter,
    reporter_task_user.user_name AS task_reporter_name,
    COALESCE(th_latest.assigned_on, t.assigned_on) AS task_assigned_on,
    COALESCE(th_latest.start_date, t.start_date) AS task_start_date,
    COALESCE(th_latest.due_date, t.due_date) AS task_due_date,
    COALESCE(th_latest.closed_on, t.closed_on) AS task_closed_on,
    COALESCE(th_latest.estimated_hours, t.estimated_hours) AS task_estimated_hours,
    COALESCE(th_latest.estimated_days, t.estimated_days) AS task_estimated_days,
    t.is_billable AS task_is_billable,
    COALESCE(th_latest.cancelled_by, t.cancelled_by) AS task_cancelled_by,
    COALESCE(th_latest.cancelled_at, t.cancelled_at) AS task_cancelled_at,
    COALESCE(th_latest.status_reason, t.cancellation_reason) AS task_cancellation_reason,
    cancelled_by_task_user.user_name AS task_cancelled_by_name,
    t.created_by AS task_created_by,
    t.created_at AS task_created_at,
    t.updated_by AS task_updated_by,
    t.updated_at AS task_updated_at,
    created_by_task_user.user_name AS task_created_by_name,
    updated_by_task_user.user_name AS task_updated_by_name,
    COALESCE(( SELECT json_agg(json_build_object('id', a.id, 'file_name', a.file_name, 'file_path', a.file_path, 'file_url', a.file_url, 'file_type', a.file_type, 'file_size', a.file_size, 'purpose', a.purpose, 'created_by', a.created_by, 'created_at', a.created_at) ORDER BY a.created_at DESC) AS json_agg
           FROM attachments a
          WHERE a.parent_type::text = 'TASK'::text AND a.parent_code = t.id), '[]'::json) AS task_attachments,
    ( SELECT count(*) AS count
           FROM attachments a
          WHERE a.parent_type::text = 'TASK'::text AND a.parent_code = t.id) AS task_attachments_count,
    COALESCE(subtask_stats.subtask_count, 0::bigint) AS task_subtask_count,
    COALESCE(( SELECT json_agg(json_build_object('id', st.id, 'subtask_title', st.subtask_title, 'description', st.description, 'status_code', COALESCE(sh_latest.status_code, st.status_code), 'status_description', sm_subtask.status_desc, 'closed_on', COALESCE(sh_latest.closed_on, st.closed_on), 'is_billable', st.is_billable, 'cancelled_by', COALESCE(sh_latest.cancelled_by, st.cancelled_by), 'cancelled_at', COALESCE(sh_latest.cancelled_at, st.cancelled_at), 'created_by', st.created_by, 'created_at', st.created_at, 'updated_by', st.updated_by, 'updated_at', st.updated_at, 'attachments_count', ( SELECT count(*) AS count
                   FROM attachments a
                  WHERE a.parent_type::text = 'SUBTASK'::text AND a.parent_code = st.id)) ORDER BY st.id) AS json_agg
           FROM subtasks st
             LEFT JOIN LATERAL ( SELECT sh.status_code,
                    sh.closed_on,
                    sh.cancelled_by,
                    sh.cancelled_at
                   FROM subtask_hist sh
                  WHERE sh.subtask_code = st.id
                  ORDER BY sh.created_at DESC, sh.id DESC
                 LIMIT 1) sh_latest ON true
             LEFT JOIN sts_new.status_master sm_subtask ON COALESCE(sh_latest.status_code, st.status_code)::text = sm_subtask.status_code::text
          WHERE st.task_id = t.id), '[]'::json) AS task_subtasks,
    ( SELECT count(*) AS count
           FROM attachments a
          WHERE a.parent_type::text = 'SUBTASK'::text AND (a.parent_code IN ( SELECT st.id
                   FROM subtasks st
                  WHERE st.task_id = t.id))) AS task_subtasks_attachments_count,
    COALESCE(( SELECT json_agg(td.depends_on_task_id ORDER BY td.depends_on_task_id) AS json_agg
           FROM task_dependencies td
          WHERE td.task_id = t.id), '[]'::json) AS task_depends_on_task_ids,
    ( SELECT count(*) AS count
           FROM task_dependencies td
          WHERE td.task_id = t.id) AS task_depends_on_task_count,
    COALESCE(( SELECT json_agg(td.task_id ORDER BY td.task_id) AS json_agg
           FROM task_dependencies td
          WHERE td.depends_on_task_id = t.id), '[]'::json) AS task_depended_on_by_task_ids,
    ( SELECT count(*) AS count
           FROM task_dependencies td
          WHERE td.depends_on_task_id = t.id) AS task_depended_on_by_task_count
   FROM epics e
     LEFT JOIN LATERAL ( SELECT eh.status_code,
            eh.status_reason,
            eh.product_code,
            eh.priority_code,
            eh.start_date,
            eh.due_date,
            eh.closed_on,
            eh.estimated_hours,
            eh.estimated_days,
            eh.cancelled_by,
            eh.cancelled_at,
            eh.reporter
           FROM epic_hist eh
          WHERE eh.epic_code = e.id
          ORDER BY eh.created_at DESC, eh.id DESC
         LIMIT 1) eh_latest ON true
     LEFT JOIN sts_new.product_master pm ON COALESCE(eh_latest.product_code, e.product_code)::text = pm.product_code::text
     LEFT JOIN sts_new.company_master cm ON e.company_code::text = cm.company_code::text
     LEFT JOIN sts_new.contact_master cpm ON e.contact_person_code::text = cpm.contact_person_code::text
     LEFT JOIN sts_new.status_master s ON COALESCE(eh_latest.status_code, e.status_code)::text = s.status_code::text
     LEFT JOIN sts_new.tkt_priority_master pr ON COALESCE(eh_latest.priority_code, e.priority_code) = pr.priority_code
     LEFT JOIN sts_new.user_master created_by_epic_user ON e.created_by::text = created_by_epic_user.user_code::text
     LEFT JOIN sts_new.user_master updated_by_epic_user ON e.updated_by::text = updated_by_epic_user.user_code::text
     LEFT JOIN sts_new.user_master cancelled_by_user ON COALESCE(eh_latest.cancelled_by, e.cancelled_by)::text = cancelled_by_user.user_code::text
     LEFT JOIN sts_new.user_master reporter_epic_user ON COALESCE(eh_latest.reporter, e.reporter)::text = reporter_epic_user.user_code::text
     LEFT JOIN ( SELECT t_stats.epic_code,
            count(*) AS task_count,
            sum(t_stats.estimated_hours) AS total_task_estimated_hours,
            sum(t_stats.estimated_days) AS total_task_estimated_days
           FROM tasks t_stats
          GROUP BY t_stats.epic_code) task_stats ON e.id = task_stats.epic_code
     LEFT JOIN tasks t ON t.epic_code = e.id
     LEFT JOIN LATERAL ( SELECT th.status_code,
            th.status_reason,
            th.priority_code,
            th.task_type_code,
            th.product_code,
            th.assigned_team_code,
            th.assignee,
            th.reporter,
            th.work_mode,
            th.assigned_on,
            th.start_date,
            th.due_date,
            th.closed_on,
            th.estimated_hours,
            th.estimated_days,
            th.cancelled_by,
            th.cancelled_at
           FROM task_hist th
          WHERE th.task_code = t.id
          ORDER BY th.created_at DESC, th.id DESC
         LIMIT 1) th_latest ON true
     LEFT JOIN sts_new.status_master s_task ON COALESCE(th_latest.status_code, t.status_code)::text = s_task.status_code::text
     LEFT JOIN sts_new.tkt_priority_master pr_task ON COALESCE(th_latest.priority_code, t.priority_code) = pr_task.priority_code
     LEFT JOIN sts_new.user_master assignee_user ON COALESCE(th_latest.assignee, t.assignee)::text = assignee_user.user_code::text
     LEFT JOIN sts_new.team_master assigned_team ON COALESCE(th_latest.assigned_team_code, t.assigned_team_code, assignee_user.team_code)::text = assigned_team.team_code::text
     LEFT JOIN sts_new.user_master reporter_task_user ON COALESCE(th_latest.reporter, t.reporter)::text = reporter_task_user.user_code::text
     LEFT JOIN sts_new.user_master created_by_task_user ON t.created_by::text = created_by_task_user.user_code::text
     LEFT JOIN sts_new.user_master updated_by_task_user ON t.updated_by::text = updated_by_task_user.user_code::text
     LEFT JOIN sts_new.user_master cancelled_by_task_user ON COALESCE(th_latest.cancelled_by, t.cancelled_by)::text = cancelled_by_task_user.user_code::text
     LEFT JOIN ( SELECT st_stats.task_id,
            count(*) AS subtask_count
           FROM subtasks st_stats
          GROUP BY st_stats.task_id) subtask_stats ON t.id = subtask_stats.task_id;

ALTER TABLE sts_ts.view_unified_epic_task
    OWNER TO sts_ts;
COMMENT ON VIEW sts_ts.view_unified_epic_task
    IS 'Comprehensive view showing actual epics, tasks, and subtasks (created by users). Tasks are shown as individual rows (one row per task). Each task row includes subtask statistics, a JSON array of all subtasks, and task dependency information (depends_on_task_ids, depends_on_task_count, depended_on_by_task_ids, depended_on_by_task_count). Predefined epics and tasks are available via master data API and are not included in this view.';

GRANT ALL ON TABLE sts_ts.view_unified_epic_task TO sts_ts;
GRANT SELECT ON TABLE sts_ts.view_unified_epic_task TO sukraa_analyst;
GRANT SELECT ON TABLE sts_ts.view_unified_epic_task TO sukraa_dev;

