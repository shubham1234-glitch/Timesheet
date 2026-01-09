-- View: sts_ts.view_team_dashboard

-- DROP VIEW sts_ts.view_team_dashboard;

CREATE OR REPLACE VIEW sts_ts.view_team_dashboard
 AS
 WITH date_ranges AS (
         SELECT CURRENT_DATE - '6 days'::interval AS last_7_days_start,
            CURRENT_DATE + '1 day'::interval AS last_7_days_end,
            date_trunc('year'::text, CURRENT_DATE::timestamp with time zone) AS year_start,
            date_trunc('year'::text, CURRENT_DATE::timestamp with time zone) + '1 year'::interval AS year_end
        ), last_7_days_timesheets AS (
         SELECT te.user_code,
            te.entry_date,
            te.total_hours,
            te.approval_status
           FROM timesheet_entry te
             CROSS JOIN date_ranges dr_1
          WHERE te.entry_date >= dr_1.last_7_days_start AND te.entry_date < dr_1.last_7_days_end
        ), daily_hours_last_7_days AS (
         WITH all_dates AS (
                 SELECT generate_series(CURRENT_DATE - '6 days'::interval, CURRENT_DATE::timestamp without time zone, '1 day'::interval)::date AS entry_date
                ), user_daily_hours AS (
                 SELECT te.user_code,
                    te.entry_date,
                    sum(te.total_hours) AS total_hours
                   FROM timesheet_entry te
                  WHERE te.entry_date >= (CURRENT_DATE - '6 days'::interval) AND te.entry_date <= CURRENT_DATE
                  GROUP BY te.user_code, te.entry_date
                ), users_with_entries AS (
                 SELECT DISTINCT user_daily_hours.user_code
                   FROM user_daily_hours
                UNION
                 SELECT user_master.user_code
                   FROM sts_new.user_master
                  WHERE user_master.is_inactive = false AND user_master.user_type_code::text <> 'C'::text
                )
         SELECT uwe.user_code,
            ad.entry_date,
            to_char(ad.entry_date::timestamp with time zone, 'DD/MM'::text) AS date_formatted,
            COALESCE(udh.total_hours, 0::numeric) AS total_hours
           FROM users_with_entries uwe
             CROSS JOIN all_dates ad
             LEFT JOIN user_daily_hours udh ON uwe.user_code::text = udh.user_code::text AND ad.entry_date = udh.entry_date
        ), user_tasks AS (
         SELECT t.assignee AS user_code,
            count(*) AS total_tasks_count,
            count(
                CASE
                    WHEN t.status_code::text = 'STS002'::text THEN 1
                    ELSE NULL::integer
                END) AS completed_tasks_count,
            count(
                CASE
                    WHEN t.status_code::text = 'STS007'::text THEN 1
                    ELSE NULL::integer
                END) AS in_progress_tasks_count,
            count(
                CASE
                    WHEN t.status_code::text = 'STS001'::text THEN 1
                    ELSE NULL::integer
                END) AS to_do_tasks_count,
            count(
                CASE
                    WHEN t.status_code::text = 'STS010'::text THEN 1
                    ELSE NULL::integer
                END) AS cancelled_tasks_count,
            count(
                CASE
                    WHEN t.due_date < CURRENT_DATE AND (t.status_code::text <> ALL (ARRAY['STS002'::character varying::text, 'STS010'::character varying::text])) THEN 1
                    ELSE NULL::integer
                END) AS overdue_tasks_count
           FROM tasks t
          WHERE t.assignee IS NOT NULL
          GROUP BY t.assignee
        ), user_subtasks AS (
         SELECT st.assignee AS user_code,
            count(*) AS total_subtasks_count,
            count(
                CASE
                    WHEN st.status_code::text = 'STS002'::text THEN 1
                    ELSE NULL::integer
                END) AS completed_subtasks_count,
            count(
                CASE
                    WHEN st.status_code::text = 'STS007'::text THEN 1
                    ELSE NULL::integer
                END) AS in_progress_subtasks_count,
            count(
                CASE
                    WHEN st.status_code::text = 'STS001'::text THEN 1
                    ELSE NULL::integer
                END) AS to_do_subtasks_count,
            count(
                CASE
                    WHEN st.status_code::text = 'STS010'::text THEN 1
                    ELSE NULL::integer
                END) AS cancelled_subtasks_count,
            count(
                CASE
                    WHEN st.due_date < CURRENT_DATE AND (st.status_code::text <> ALL (ARRAY['STS002'::character varying::text, 'STS010'::character varying::text])) THEN 1
                    ELSE NULL::integer
                END) AS overdue_subtasks_count
           FROM subtasks st
          WHERE st.assignee IS NOT NULL
          GROUP BY st.assignee
        ), pending_approvals AS (
         SELECT combined.user_code,
            sum(
                CASE
                    WHEN combined.approval_status::text = 'SUBMITTED'::text AND combined.source = 'timesheet'::text THEN 1
                    ELSE 0
                END) AS pending_timesheet_count,
            sum(
                CASE
                    WHEN combined.approval_status::text = 'SUBMITTED'::text AND combined.source = 'leave'::text THEN 1
                    ELSE 0
                END) AS pending_leave_count
           FROM ( SELECT te.user_code,
                    te.approval_status,
                    'timesheet'::text AS source
                   FROM timesheet_entry te
                  WHERE te.approval_status::text = 'SUBMITTED'::text
                UNION ALL
                 SELECT la.user_code,
                    la.approval_status,
                    'leave'::text AS source
                   FROM leave_application la
                  WHERE la.approval_status::text = 'SUBMITTED'::text) combined
          GROUP BY combined.user_code
        ), timesheet_status_breakdown AS (
         SELECT te.user_code,
            count(
                CASE
                    WHEN te.approval_status::text = 'APPROVED'::text THEN 1
                    ELSE NULL::integer
                END) AS timesheet_approved_count,
            count(
                CASE
                    WHEN te.approval_status::text = 'SUBMITTED'::text THEN 1
                    ELSE NULL::integer
                END) AS timesheet_pending_count,
            count(
                CASE
                    WHEN te.approval_status::text = 'REJECTED'::text THEN 1
                    ELSE NULL::integer
                END) AS timesheet_rejected_count
           FROM timesheet_entry te
          GROUP BY te.user_code
        ), leave_status_breakdown AS (
         SELECT la.user_code,
            count(
                CASE
                    WHEN la.approval_status::text = 'APPROVED'::text THEN 1
                    ELSE NULL::integer
                END) AS leave_approved_count,
            count(
                CASE
                    WHEN la.approval_status::text = 'SUBMITTED'::text THEN 1
                    ELSE NULL::integer
                END) AS leave_pending_count,
            count(
                CASE
                    WHEN la.approval_status::text = 'REJECTED'::text THEN 1
                    ELSE NULL::integer
                END) AS leave_rejected_count
           FROM leave_application la
          GROUP BY la.user_code
        ), leave_registry AS (
         SELECT la.user_code,
            COALESCE(sum(
                CASE
                    WHEN la.approval_status::text = 'APPROVED'::text THEN la.duration_days
                    ELSE 0::numeric
                END), 0::numeric) AS leaves_taken
           FROM leave_application la
             CROSS JOIN date_ranges dr_1
          WHERE la.from_date >= dr_1.year_start AND la.from_date < dr_1.year_end
          GROUP BY la.user_code
        )
 SELECT um.user_code,
    um.user_name,
    COALESCE(sum(ts.total_hours), 0::numeric) AS total_hours_last_7_days,
    COALESCE(pa.pending_timesheet_count, 0::bigint) AS pending_timesheet_count,
    COALESCE(pa.pending_leave_count, 0::bigint) AS pending_leave_count,
    COALESCE(pa.pending_timesheet_count, 0::bigint) + COALESCE(pa.pending_leave_count, 0::bigint) AS total_pending_approvals,
    COALESCE(ut.total_tasks_count, 0::bigint) AS total_tasks,
    COALESCE(ut.completed_tasks_count, 0::bigint) AS completed_tasks,
    COALESCE(ut.overdue_tasks_count, 0::bigint) AS overdue_tasks,
    COALESCE(ust.total_subtasks_count, 0::bigint) AS total_subtasks,
    COALESCE(ust.completed_subtasks_count, 0::bigint) AS completed_subtasks,
    COALESCE(ust.in_progress_subtasks_count, 0::bigint) AS in_progress_subtasks,
    COALESCE(ust.to_do_subtasks_count, 0::bigint) AS to_do_subtasks,
    COALESCE(ust.cancelled_subtasks_count, 0::bigint) AS cancelled_subtasks,
    COALESCE(ust.overdue_subtasks_count, 0::bigint) AS overdue_subtasks,
    COALESCE(lr.leaves_taken, 0::numeric) AS leaves_taken,
    COALESCE(tsb.timesheet_approved_count, 0::bigint) AS timesheet_approved_count,
    COALESCE(tsb.timesheet_pending_count, 0::bigint) AS timesheet_pending_count,
    COALESCE(tsb.timesheet_rejected_count, 0::bigint) AS timesheet_rejected_count,
    COALESCE(lsb.leave_approved_count, 0::bigint) AS leave_approved_count,
    COALESCE(lsb.leave_pending_count, 0::bigint) AS leave_pending_count,
    COALESCE(lsb.leave_rejected_count, 0::bigint) AS leave_rejected_count,
    COALESCE(ut.completed_tasks_count, 0::bigint) AS task_completed_count,
    COALESCE(ut.in_progress_tasks_count, 0::bigint) AS task_in_progress_count,
    COALESCE(ut.to_do_tasks_count, 0::bigint) AS task_to_do_count,
    COALESCE(ut.cancelled_tasks_count, 0::bigint) AS task_cancelled_count,
    COALESCE(ut.overdue_tasks_count, 0::bigint) AS task_overdue_count,
    COALESCE(( SELECT json_agg(json_build_object('date', dhd.date_formatted, 'entry_date', dhd.entry_date, 'hours', round(dhd.total_hours, 2)) ORDER BY dhd.entry_date) AS json_agg
           FROM daily_hours_last_7_days dhd
          WHERE dhd.user_code::text = um.user_code::text), '[]'::json) AS daily_hours_last_7_days,
    dr.last_7_days_start,
    CURRENT_DATE AS last_7_days_end,
    dr.year_start AS current_year_start,
    dr.year_start + '1 year'::interval - '1 day'::interval AS current_year_end
   FROM sts_new.user_master um
     CROSS JOIN date_ranges dr
     LEFT JOIN last_7_days_timesheets ts ON um.user_code::text = ts.user_code::text
     LEFT JOIN user_tasks ut ON um.user_code::text = ut.user_code::text
     LEFT JOIN user_subtasks ust ON um.user_code::text = ust.user_code::text
     LEFT JOIN pending_approvals pa ON um.user_code::text = pa.user_code::text
     LEFT JOIN timesheet_status_breakdown tsb ON um.user_code::text = tsb.user_code::text
     LEFT JOIN leave_status_breakdown lsb ON um.user_code::text = lsb.user_code::text
     LEFT JOIN leave_registry lr ON um.user_code::text = lr.user_code::text
  WHERE um.is_inactive = false AND um.user_type_code::text <> 'C'::text
  GROUP BY um.user_code, um.user_name, ut.total_tasks_count, ut.completed_tasks_count, ut.in_progress_tasks_count, ut.to_do_tasks_count, ut.cancelled_tasks_count, ut.overdue_tasks_count, ust.total_subtasks_count, ust.completed_subtasks_count, ust.in_progress_subtasks_count, ust.to_do_subtasks_count, ust.cancelled_subtasks_count, ust.overdue_subtasks_count, pa.pending_timesheet_count, pa.pending_leave_count, tsb.timesheet_approved_count, tsb.timesheet_pending_count, tsb.timesheet_rejected_count, lsb.leave_approved_count, lsb.leave_pending_count, lsb.leave_rejected_count, lr.leaves_taken, dr.last_7_days_start, dr.year_start
  ORDER BY um.user_name;

ALTER TABLE sts_ts.view_team_dashboard
    OWNER TO sts_ts;

