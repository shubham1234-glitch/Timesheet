-- View: sts_ts.view_timesheet_entry

-- DROP VIEW sts_ts.view_timesheet_entry;

CREATE OR REPLACE VIEW sts_ts.view_timesheet_entry
 AS
 SELECT te.id AS timesheet_entry_id,
    te.entry_date,
    te.approval_status,
    te.actual_hours_worked,
    te.travel_time,
    te.waiting_time,
    te.total_hours,
    te.work_location,
    te.task_type_code,
    te.description,
    te.created_at AS timesheet_created_at,
    te.updated_at AS timesheet_updated_at,
    te.user_code,
    um_worked.user_name,
    um_worked.first_name AS user_first_name,
    um_worked.last_name AS user_last_name,
    um_worked.email_id AS user_email,
    um_worked.contact_num AS user_contact,
    um_worked.designation_name AS user_designation,
    um_worked.team_code AS user_team_code,
    tm_worked.team_name AS user_team_name,
    tm_worked.team_lead AS user_team_lead,
    tm_worked.reporter AS user_reporter,
    te.task_code,
    t.task_title,
    t.description AS task_description,
    COALESCE(th_latest.status_code, t.status_code) AS task_status_code,
    sm_task.status_desc AS task_status_description,
    COALESCE(th_latest.priority_code, t.priority_code) AS task_priority_code,
    pr_task.priority_desc AS task_priority_description,
    COALESCE(th_latest.task_type_code, t.task_type_code) AS task_task_type_code,
    COALESCE(th_latest.work_mode, t.work_mode) AS task_work_mode,
    COALESCE(th_latest.product_code, t.product_code) AS task_product_code,
    COALESCE(th_latest.assigned_team_code, assignee_user.team_code) AS task_team_code,
    assigned_team.team_name AS task_assigned_team_name,
    COALESCE(th_latest.assignee, t.assignee) AS task_assignee,
    um_assignee.user_name AS task_assignee_name,
    COALESCE(th_latest.reporter, t.reporter) AS task_reporter,
    um_reporter.user_name AS task_reporter_name,
    COALESCE(th_latest.assigned_on, t.assigned_on) AS task_assigned_on,
    COALESCE(th_latest.start_date, t.start_date) AS task_start_date,
    COALESCE(th_latest.due_date, t.due_date) AS task_due_date,
    COALESCE(th_latest.closed_on, t.closed_on) AS task_closed_on,
    COALESCE(th_latest.estimated_hours, t.estimated_hours) AS task_estimated_hours,
    COALESCE(th_latest.estimated_days, t.estimated_days) AS task_estimated_days,
    t.is_billable AS task_is_billable,
    te.epic_code,
    e.epic_title,
    e.epic_description,
    COALESCE(eh_latest.product_code, e.product_code) AS epic_product_code,
    pm.product_name AS epic_product_name,
    e.company_code AS epic_company_code,
    cm.company_name AS epic_company_name,
    e.contact_person_code AS epic_contact_person_code,
    cpm.full_name AS epic_contact_person_name,
    COALESCE(eh_latest.reporter, e.reporter) AS epic_reporter,
    um_epic_reporter.user_name AS epic_reporter_name,
    e.status_code AS epic_status_code,
    sm_epic.status_desc AS epic_status_description,
    e.priority_code AS epic_priority_code,
    pr_epic.priority_desc AS epic_priority_description,
    te.activity_code,
    a.activity_title,
    a.activity_description,
    a.product_code AS activity_product_code,
    pm_activity.product_name AS activity_product_name,
    pm_activity.version AS activity_product_version,
    pm_activity.product_desc AS activity_product_description,
    a.is_billable AS activity_is_billable,
    te.subtask_code,
    st.subtask_title,
    st.description AS subtask_description,
    COALESCE(sh_latest.status_code, st.status_code) AS subtask_status_code,
    sm_subtask.status_desc AS subtask_status_description,
    COALESCE(sh_latest.closed_on, st.closed_on) AS subtask_closed_on,
    st.is_billable AS subtask_is_billable,
    st.task_id AS subtask_parent_task_id,
    t_subtask.task_title AS subtask_parent_task_title,
    te.ticket_code,
    tkt.title AS ticket_title,
    tkt.description AS ticket_description,
    COALESCE(sh_ticket.status_desc, 'Unassigned'::character varying) AS ticket_status,
    sh_ticket.status_code AS ticket_status_code,
    COALESCE(pr_ticket.priority_desc, pr_ticket_hist.priority_desc) AS ticket_priority,
    COALESCE(pr_ticket.priority_code, pr_ticket_hist.priority_code) AS ticket_priority_code,
    tkt.company_code AS ticket_company_code,
    cm_ticket.company_name AS ticket_company_name,
    tkt.product_code AS ticket_product_code,
    pm_ticket.product_name AS ticket_product_name,
    tkt.contact_person_code AS ticket_contact_person_code,
    cpm_ticket.full_name AS ticket_contact_person_name,
    tkt.category_code AS ticket_category_code,
    cat_ticket.category_name AS ticket_type,
    sh_ticket.assignee AS ticket_assignee,
    um_ticket_assignee.user_name AS ticket_assignee_name,
    tkt.start_date AS ticket_start_date,
    tkt.due_date AS ticket_due_date,
    tkt.resolved_on AS ticket_resolved_on,
    tkt.closed_on AS ticket_closed_on,
    tkt.is_billable AS ticket_is_billable,
    te.submitted_by,
    um_submitted.user_name AS submitted_by_name,
    te.submitted_at,
    te.approved_by,
    um_approved.user_name AS approved_by_name,
    te.approved_at,
    te.rejected_by,
    um_rejected.user_name AS rejected_by_name,
    te.rejected_at,
    te.rejection_reason,
    tah_latest.id AS latest_approval_history_id,
    tah_latest.approval_status AS latest_approval_status,
    tah_latest.status_reason AS latest_status_reason,
    tah_latest.submitted_by AS latest_submitted_by,
    tah_latest.submitted_at AS latest_submitted_at,
    um_latest_submitted.user_name AS latest_submitted_by_name,
    tah_latest.approved_by AS latest_approved_by,
    tah_latest.approved_at AS latest_approved_at,
    um_latest_approved.user_name AS latest_approved_by_name,
    tah_latest.rejected_by AS latest_rejected_by,
    tah_latest.rejected_at AS latest_rejected_at,
    um_latest_rejected.user_name AS latest_rejected_by_name,
    tah_latest.status_reason AS latest_rejection_reason,
    tah_latest.created_at AS latest_approval_history_created_at,
    tah_latest.task_code AS latest_approval_task_code,
    tah_latest.epic_code AS latest_approval_epic_code,
    tah_latest.activity_code AS latest_approval_activity_code,
    tah_latest.ticket_code AS latest_approval_ticket_code,
    tah_latest.subtask_code AS latest_approval_subtask_code,
    te.created_by,
    um_created.user_name AS created_by_name,
    te.updated_by,
    um_updated.user_name AS updated_by_name,
    COALESCE(( SELECT json_agg(json_build_object('id', a_1.id, 'file_name', a_1.file_name, 'file_path', a_1.file_path, 'file_url', a_1.file_url, 'file_type', a_1.file_type, 'file_size', a_1.file_size, 'purpose', a_1.purpose, 'created_by', a_1.created_by, 'created_at', a_1.created_at) ORDER BY a_1.created_at DESC) AS json_agg
           FROM attachments a_1
          WHERE a_1.parent_type::text = 'TIMESHEET_ENTRY'::text AND a_1.parent_code = te.id), '[]'::json) AS attachments,
    ( SELECT count(*) AS count
           FROM attachments a_1
          WHERE a_1.parent_type::text = 'TIMESHEET_ENTRY'::text AND a_1.parent_code = te.id) AS attachments_count,
        CASE
            WHEN te.task_code IS NOT NULL THEN ( SELECT COALESCE(sum(te_sum.total_hours), 0::numeric) > 8::numeric
               FROM timesheet_entry te_sum
              WHERE te_sum.task_code = te.task_code AND (te_sum.approval_status::text = ANY (ARRAY['APPROVED'::character varying, 'SUBMITTED'::character varying]::text[])))
            ELSE false
        END AS task_is_overdue,
        CASE
            WHEN te.task_code IS NOT NULL THEN ( SELECT COALESCE(sum(te_sum.total_hours), 0::numeric)
               FROM timesheet_entry te_sum
              WHERE te_sum.task_code = te.task_code AND te_sum.user_code = te.user_code)
            ELSE NULL::numeric
        END AS task_total_actual_hours
   FROM ( SELECT DISTINCT ON (te_inner.user_code, te_inner.entry_date, (COALESCE(te_inner.task_code::text, te_inner.activity_code::text, te_inner.ticket_code::text, te_inner.subtask_code::text, 'NO_PARENT'::text))) te_inner.id,
            te_inner.task_code,
            te_inner.epic_code,
            te_inner.activity_code,
            te_inner.ticket_code,
            te_inner.subtask_code,
            te_inner.entry_date,
            te_inner.user_code,
            te_inner.approval_status,
            te_inner.actual_hours_worked,
            te_inner.travel_time,
            te_inner.waiting_time,
            te_inner.total_hours,
            te_inner.work_location,
            te_inner.task_type_code,
            te_inner.description,
            te_inner.submitted_by,
            te_inner.submitted_at,
            te_inner.approved_by,
            te_inner.approved_at,
            te_inner.rejected_by,
            te_inner.rejected_at,
            te_inner.rejection_reason,
            te_inner.created_by,
            te_inner.created_at,
            te_inner.updated_by,
            te_inner.updated_at
           FROM timesheet_entry te_inner
             LEFT JOIN LATERAL ( SELECT tah.approval_status,
                    tah.created_at AS latest_hist_created_at,
                        CASE
                            WHEN tah.approval_status::text = 'APPROVED'::text THEN 1
                            WHEN tah.approval_status::text = 'SUBMITTED'::text THEN 2
                            WHEN tah.approval_status::text = 'DRAFT'::text THEN 3
                            ELSE 4
                        END AS status_priority
                   FROM timesheet_approval_hist tah
                  WHERE tah.entry_id = te_inner.id
                  ORDER BY (
                        CASE
                            WHEN tah.approval_status::text = 'APPROVED'::text THEN 1
                            WHEN tah.approval_status::text = 'SUBMITTED'::text THEN 2
                            WHEN tah.approval_status::text = 'DRAFT'::text THEN 3
                            ELSE 4
                        END), tah.created_at DESC, tah.id DESC
                 LIMIT 1) latest_hist ON true
          WHERE te_inner.entry_date IS NOT NULL
          ORDER BY te_inner.user_code, te_inner.entry_date, (COALESCE(te_inner.task_code::text, te_inner.activity_code::text, te_inner.ticket_code::text, te_inner.subtask_code::text, 'NO_PARENT'::text)), (COALESCE(latest_hist.status_priority,
                CASE
                    WHEN te_inner.approval_status::text = 'APPROVED'::text THEN 1
                    WHEN te_inner.approval_status::text = 'SUBMITTED'::text THEN 2
                    WHEN te_inner.approval_status::text = 'DRAFT'::text THEN 3
                    ELSE 4
                END)), (COALESCE(latest_hist.latest_hist_created_at, te_inner.updated_at, te_inner.created_at)) DESC, te_inner.id DESC) te
     LEFT JOIN sts_new.user_master um_worked ON te.user_code::text = um_worked.user_code::text
     LEFT JOIN sts_new.team_master tm_worked ON um_worked.team_code::text = tm_worked.team_code::text
     LEFT JOIN tasks t ON te.task_code = t.id
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
            th.estimated_days
           FROM task_hist th
          WHERE th.task_code = t.id
          ORDER BY th.created_at DESC, th.id DESC
         LIMIT 1) th_latest ON true
     LEFT JOIN sts_new.status_master sm_task ON COALESCE(th_latest.status_code, t.status_code)::text = sm_task.status_code::text
     LEFT JOIN sts_new.tkt_priority_master pr_task ON COALESCE(th_latest.priority_code, t.priority_code) = pr_task.priority_code
     LEFT JOIN sts_new.user_master assignee_user ON COALESCE(th_latest.assignee, t.assignee)::text = assignee_user.user_code::text
     LEFT JOIN sts_new.team_master assigned_team ON COALESCE(th_latest.assigned_team_code, assignee_user.team_code)::text = assigned_team.team_code::text
     LEFT JOIN sts_new.user_master um_assignee ON COALESCE(th_latest.assignee, t.assignee)::text = um_assignee.user_code::text
     LEFT JOIN sts_new.user_master um_reporter ON COALESCE(th_latest.reporter, t.reporter)::text = um_reporter.user_code::text
     LEFT JOIN epics e ON te.epic_code = e.id
     LEFT JOIN LATERAL ( SELECT eh.product_code,
            eh.reporter
           FROM epic_hist eh
          WHERE eh.epic_code = e.id
          ORDER BY eh.created_at DESC, eh.id DESC
         LIMIT 1) eh_latest ON true
     LEFT JOIN sts_new.product_master pm ON COALESCE(eh_latest.product_code, e.product_code)::text = pm.product_code::text
     LEFT JOIN sts_new.company_master cm ON e.company_code::text = cm.company_code::text
     LEFT JOIN sts_new.contact_master cpm ON e.contact_person_code::text = cpm.contact_person_code::text
     LEFT JOIN sts_new.user_master um_epic_reporter ON COALESCE(eh_latest.reporter, e.reporter)::text = um_epic_reporter.user_code::text
     LEFT JOIN sts_new.status_master sm_epic ON e.status_code::text = sm_epic.status_code::text
     LEFT JOIN sts_new.tkt_priority_master pr_epic ON e.priority_code = pr_epic.priority_code
     LEFT JOIN activities a ON te.activity_code = a.id
     LEFT JOIN sts_new.product_master pm_activity ON a.product_code::text = pm_activity.product_code::text
     LEFT JOIN subtasks st ON te.subtask_code = st.id
     LEFT JOIN LATERAL ( SELECT sh.status_code,
            sh.closed_on
           FROM subtask_hist sh
          WHERE sh.subtask_code = st.id
          ORDER BY sh.created_at DESC, sh.id DESC
         LIMIT 1) sh_latest ON true
     LEFT JOIN sts_new.status_master sm_subtask ON COALESCE(sh_latest.status_code, st.status_code)::text = sm_subtask.status_code::text
     LEFT JOIN tasks t_subtask ON st.task_id = t_subtask.id
     LEFT JOIN sts_new.ticket_master tkt ON te.ticket_code = tkt.ticket_code
     LEFT JOIN LATERAL ( SELECT DISTINCT ON (sh_inner.ticket_code) sh_inner.ticket_code,
            sh_inner.status_desc,
            sh_inner.status_code,
            sh_inner.assignee,
            sh_inner.assigned_on
           FROM sts_new.status_hist sh_inner
          WHERE sh_inner.ticket_code::text = tkt.ticket_code::text
          ORDER BY sh_inner.ticket_code, sh_inner.created_at DESC
         LIMIT 1) sh_ticket ON true
     LEFT JOIN LATERAL ( SELECT DISTINCT ON (ph_inner.ticket_code) ph_inner.ticket_code,
            ph_inner.priority_desc,
            ph_inner.priority_code
           FROM sts_new.tkt_priority_hist ph_inner
          WHERE ph_inner.ticket_code::text = tkt.ticket_code::text
          ORDER BY ph_inner.ticket_code, ph_inner.created_at DESC
         LIMIT 1) pr_ticket_hist ON true
     LEFT JOIN sts_new.tkt_priority_master pr_ticket ON COALESCE(pr_ticket_hist.priority_code, ( SELECT DISTINCT ON (ph2.ticket_code) ph2.priority_code
           FROM sts_new.tkt_priority_hist ph2
          WHERE ph2.ticket_code::text = tkt.ticket_code::text
          ORDER BY ph2.ticket_code, ph2.created_at DESC
         LIMIT 1)) = pr_ticket.priority_code
     LEFT JOIN sts_new.company_master cm_ticket ON tkt.company_code::text = cm_ticket.company_code::text
     LEFT JOIN sts_new.product_master pm_ticket ON tkt.product_code::text = pm_ticket.product_code::text
     LEFT JOIN sts_new.contact_master cpm_ticket ON tkt.contact_person_code::text = cpm_ticket.contact_person_code::text
     LEFT JOIN sts_new.category_master cat_ticket ON tkt.category_code::text = cat_ticket.category_code::text
     LEFT JOIN sts_new.user_master um_ticket_assignee ON sh_ticket.assignee::text = um_ticket_assignee.user_code::text
     LEFT JOIN sts_new.user_master um_submitted ON te.submitted_by::text = um_submitted.user_code::text
     LEFT JOIN sts_new.user_master um_approved ON te.approved_by::text = um_approved.user_code::text
     LEFT JOIN sts_new.user_master um_rejected ON te.rejected_by::text = um_rejected.user_code::text
     LEFT JOIN LATERAL ( SELECT tah.id,
            tah.approval_status,
            tah.status_reason,
            tah.submitted_by,
            tah.submitted_at,
            tah.approved_by,
            tah.approved_at,
            tah.rejected_by,
            tah.rejected_at,
            tah.created_at,
            tah.task_code,
            tah.epic_code,
            tah.activity_code,
            tah.ticket_code,
            tah.subtask_code
           FROM timesheet_approval_hist tah
          WHERE tah.entry_id = te.id
          ORDER BY tah.created_at DESC
         LIMIT 1) tah_latest ON true
     LEFT JOIN sts_new.user_master um_latest_submitted ON tah_latest.submitted_by::text = um_latest_submitted.user_code::text
     LEFT JOIN sts_new.user_master um_latest_approved ON tah_latest.approved_by::text = um_latest_approved.user_code::text
     LEFT JOIN sts_new.user_master um_latest_rejected ON tah_latest.rejected_by::text = um_latest_rejected.user_code::text
     LEFT JOIN sts_new.user_master um_created ON te.created_by::text = um_created.user_code::text
     LEFT JOIN sts_new.user_master um_updated ON te.updated_by::text = um_updated.user_code::text;

ALTER TABLE sts_ts.view_timesheet_entry
    OWNER TO sts_ts;

GRANT ALL ON TABLE sts_ts.view_timesheet_entry TO sts_ts;
GRANT SELECT ON TABLE sts_ts.view_timesheet_entry TO sukraa_analyst;
GRANT SELECT ON TABLE sts_ts.view_timesheet_entry TO sukraa_dev;

