-- View: sts_ts.view_my_dashboard

-- DROP VIEW sts_ts.view_my_dashboard;

CREATE OR REPLACE VIEW sts_ts.view_my_dashboard
 AS
 WITH date_ranges AS (
         SELECT date_trunc('month'::text, CURRENT_DATE::timestamp with time zone)::date AS month_start,
            (date_trunc('month'::text, CURRENT_DATE::timestamp with time zone) + '1 mon'::interval)::date AS month_end,
            date_trunc('week'::text, CURRENT_DATE::timestamp with time zone)::date AS week_start,
            (date_trunc('week'::text, CURRENT_DATE::timestamp with time zone) + '7 days'::interval)::date AS week_end,
            date_trunc('year'::text, CURRENT_DATE::timestamp with time zone)::date AS year_start,
            (date_trunc('year'::text, CURRENT_DATE::timestamp with time zone) + '1 year'::interval)::date AS year_end
        ), current_month_timesheets AS (
         SELECT timesheet_entry.user_code,
            timesheet_entry.entry_date,
            timesheet_entry.total_hours,
            timesheet_entry.approval_status,
            timesheet_entry.epic_code,
            timesheet_entry.task_code,
            timesheet_entry.activity_code
           FROM timesheet_entry
             CROSS JOIN date_ranges dr_1
          WHERE timesheet_entry.entry_date >= dr_1.month_start AND timesheet_entry.entry_date < dr_1.month_end
        ), current_week_timesheets AS (
         SELECT timesheet_entry.user_code,
            timesheet_entry.entry_date,
            timesheet_entry.total_hours,
            EXTRACT(dow FROM timesheet_entry.entry_date) AS day_of_week,
            to_char(timesheet_entry.entry_date::timestamp with time zone, 'Dy'::text) AS day_name
           FROM timesheet_entry
             CROSS JOIN date_ranges dr_1
          WHERE timesheet_entry.entry_date >= dr_1.week_start AND timesheet_entry.entry_date < dr_1.week_end
        ), user_tasks AS (
         SELECT tasks.assignee AS user_code,
            count(*) AS total_tasks_count,
            count(
                CASE
                    WHEN tasks.status_code::text = 'STS002'::text THEN 1
                    ELSE NULL::integer
                END) AS completed_tasks_count,
            count(
                CASE
                    WHEN tasks.status_code::text = 'STS001'::text THEN 1
                    ELSE NULL::integer
                END) AS to_do_tasks_count,
            count(
                CASE
                    WHEN tasks.status_code::text = 'STS007'::text THEN 1
                    ELSE NULL::integer
                END) AS in_progress_tasks_count,
            count(
                CASE
                    WHEN tasks.status_code::text = 'STS010'::text THEN 1
                    ELSE NULL::integer
                END) AS cancelled_tasks_count,
            count(
                CASE
                    WHEN tasks.due_date < CURRENT_DATE AND (tasks.status_code::text <> ALL (ARRAY['STS002'::character varying::text, 'STS010'::character varying::text])) THEN 1
                    ELSE NULL::integer
                END) AS overdue_tasks_count
           FROM tasks
          WHERE tasks.assignee IS NOT NULL
          GROUP BY tasks.assignee
        ), user_subtasks AS (
         SELECT um_1.user_code,
            0::bigint AS total_subtasks_count,
            0::bigint AS completed_subtasks_count,
            0::bigint AS to_do_subtasks_count,
            0::bigint AS in_progress_subtasks_count,
            0::bigint AS cancelled_subtasks_count,
            0::bigint AS overdue_subtasks_count
           FROM sts_new.user_master um_1
        ), epic_hours_agg AS (
         SELECT te.user_code,
            e.id AS epic_id,
            e.epic_title,
            NULL::integer AS activity_id,
            NULL::text AS activity_title,
            NULL::text AS product_code,
            sum(te.total_hours) AS total_hours_sum
           FROM timesheet_entry te
             JOIN epics e ON te.epic_code = e.id
             CROSS JOIN date_ranges dr_1
          WHERE te.entry_date >= dr_1.month_start AND te.entry_date < dr_1.month_end AND te.total_hours > 0::numeric AND te.task_code IS NOT NULL
          GROUP BY te.user_code, e.id, e.epic_title
        UNION ALL
         SELECT te.user_code,
            NULL::integer AS epic_id,
            NULL::text AS epic_title,
            a.id AS activity_id,
            a.activity_title,
            a.product_code,
            sum(te.total_hours) AS total_hours_sum
           FROM timesheet_entry te
             JOIN activities a ON te.activity_code = a.id
             CROSS JOIN date_ranges dr_1
          WHERE te.entry_date >= dr_1.month_start AND te.entry_date < dr_1.month_end AND te.total_hours > 0::numeric AND te.activity_code IS NOT NULL
          GROUP BY te.user_code, a.id, a.activity_title, a.product_code
        ), daily_hours_agg AS (
         WITH week_days AS (
                 SELECT generate_series(0, 6) AS day_of_week
                ), day_names AS (
                 SELECT 0 AS dow,
                    'Sun'::text AS day_name
                UNION ALL
                 SELECT 1,
                    'Mon'::text AS text
                UNION ALL
                 SELECT 2,
                    'Tue'::text AS text
                UNION ALL
                 SELECT 3,
                    'Wed'::text AS text
                UNION ALL
                 SELECT 4,
                    'Thu'::text AS text
                UNION ALL
                 SELECT 5,
                    'Fri'::text AS text
                UNION ALL
                 SELECT 6,
                    'Sat'::text AS text
                ), user_daily_hours AS (
                 SELECT tw.user_code,
                    tw.day_of_week,
                    sum(tw.total_hours) AS total_hours
                   FROM current_week_timesheets tw
                  WHERE tw.total_hours > 0::numeric
                  GROUP BY tw.user_code, tw.day_of_week
                ), all_users AS (
                 SELECT user_master.user_code
                   FROM sts_new.user_master
                  WHERE user_master.is_inactive = false AND user_master.user_type_code::text <> 'C'::text
                )
         SELECT au.user_code,
            wd.day_of_week,
            dn.day_name,
            COALESCE(udh.total_hours, 0::numeric) AS total_hours
           FROM all_users au
             CROSS JOIN week_days wd
             JOIN day_names dn ON wd.day_of_week = dn.dow
             LEFT JOIN user_daily_hours udh ON au.user_code::text = udh.user_code::text AND wd.day_of_week::numeric = udh.day_of_week
        ), leave_registry AS (
         SELECT la.user_code,
            COALESCE(sum(
                CASE
                    WHEN la.approval_status::text = 'APPROVED'::text AND la.leave_type_code::text <> 'LT005'::text THEN la.duration_days
                    ELSE 0::numeric
                END), 0::numeric) AS leaves_taken,
            COALESCE(count(
                CASE
                    WHEN la.approval_status::text = 'APPROVED'::text AND la.leave_type_code::text = 'LT005'::text THEN 1
                    ELSE NULL::integer
                END), 0::bigint) AS permissions_taken
           FROM leave_application la
             CROSS JOIN date_ranges dr_1
          WHERE la.from_date >= dr_1.year_start AND la.from_date < dr_1.year_end
          GROUP BY la.user_code
        )
 SELECT um.user_code,
    um.user_name,
    COALESCE(sum(tm.total_hours), 0::numeric) AS total_hours_worked,
        CASE
            WHEN count(DISTINCT tm.entry_date) > 0 THEN round(COALESCE(sum(tm.total_hours), 0::numeric) / count(DISTINCT tm.entry_date)::numeric, 2)
            ELSE 0::numeric
        END AS avg_hours_per_day,
    COALESCE(ut.total_tasks_count, 0::bigint) AS total_tasks,
    COALESCE(ut.completed_tasks_count, 0::bigint) AS completed_tasks,
    COALESCE(ut.to_do_tasks_count, 0::bigint) AS to_do_tasks,
    COALESCE(ut.in_progress_tasks_count, 0::bigint) AS in_progress_tasks,
    COALESCE(ut.cancelled_tasks_count, 0::bigint) AS cancelled_tasks,
    COALESCE(ut.overdue_tasks_count, 0::bigint) AS overdue_tasks,
    COALESCE(ust.total_subtasks_count, 0::bigint) AS total_subtasks,
    COALESCE(ust.completed_subtasks_count, 0::bigint) AS completed_subtasks,
    COALESCE(ust.to_do_subtasks_count, 0::bigint) AS to_do_subtasks,
    COALESCE(ust.in_progress_subtasks_count, 0::bigint) AS in_progress_subtasks,
    COALESCE(ust.cancelled_subtasks_count, 0::bigint) AS cancelled_subtasks,
    COALESCE(ust.overdue_subtasks_count, 0::bigint) AS overdue_subtasks,
    COALESCE(( SELECT json_agg(json_build_object('epic_id', eha.epic_id, 'epic_title', eha.epic_title, 'activity_id', eha.activity_id, 'activity_title', eha.activity_title, 'product_code', eha.product_code, 'entry_type',
                CASE
                    WHEN eha.epic_id IS NOT NULL THEN 'EPIC'::text
                    ELSE 'ACTIVITY'::text
                END, 'total_hours', round(eha.total_hours_sum, 2)) ORDER BY eha.total_hours_sum DESC) AS json_agg
           FROM epic_hours_agg eha
          WHERE eha.user_code::text = um.user_code::text), '[]'::json) AS hours_by_project,
    COALESCE(( SELECT json_agg(json_build_object('day', dha.day_name, 'day_of_week', dha.day_of_week, 'hours', round(dha.total_hours, 2)) ORDER BY dha.day_of_week) AS json_agg
           FROM daily_hours_agg dha
          WHERE dha.user_code::text = um.user_code::text), '[]'::json) AS daily_work_hours,
    COALESCE(sum(
        CASE
            WHEN tm.approval_status::text = 'APPROVED'::text THEN 1
            ELSE 0
        END), 0::bigint) AS approved_count,
    COALESCE(sum(
        CASE
            WHEN tm.approval_status::text = 'SUBMITTED'::text THEN 1
            ELSE 0
        END), 0::bigint) AS pending_count,
    COALESCE(sum(
        CASE
            WHEN tm.approval_status::text = 'DRAFT'::text THEN 1
            ELSE 0
        END), 0::bigint) AS draft_count,
    COALESCE(sum(
        CASE
            WHEN tm.approval_status::text = 'REJECTED'::text THEN 1
            ELSE 0
        END), 0::bigint) AS rejected_count,
        CASE
            WHEN count(tm.entry_date) > 0 THEN round(COALESCE(sum(
            CASE
                WHEN tm.approval_status::text = 'APPROVED'::text THEN 1
                ELSE 0
            END), 0::bigint)::numeric / count(tm.entry_date)::numeric * 100::numeric, 2)
            ELSE 0::numeric
        END AS approval_rate_percentage,
    count(DISTINCT tm.entry_date) AS days_worked_current_month,
    count(tm.entry_date) AS total_timesheet_entries_current_month,
    dr.month_start AS current_month_start,
    (dr.month_start + '1 mon'::interval - '1 day'::interval)::date AS current_month_end,
    dr.week_start AS current_week_start,
    (dr.week_start + '6 days'::interval)::date AS current_week_end,
    12 AS total_leaves_allocated,
    24 AS total_permissions_allocated,
    COALESCE(lr.leaves_taken, 0::numeric) AS leaves_taken,
    COALESCE(lr.permissions_taken, 0::bigint) AS permissions_taken,
    12::numeric - COALESCE(lr.leaves_taken, 0::numeric) AS leaves_remaining,
    24 - COALESCE(lr.permissions_taken, 0::bigint) AS permissions_remaining,
    dr.year_start AS current_year_start,
    (dr.year_start + '1 year'::interval - '1 day'::interval)::date AS current_year_end
   FROM sts_new.user_master um
     CROSS JOIN date_ranges dr
     LEFT JOIN current_month_timesheets tm ON um.user_code::text = tm.user_code::text
     LEFT JOIN user_tasks ut ON um.user_code::text = ut.user_code::text
     LEFT JOIN user_subtasks ust ON um.user_code::text = ust.user_code::text
     LEFT JOIN leave_registry lr ON um.user_code::text = lr.user_code::text
  WHERE um.is_inactive = false AND um.user_type_code::text <> 'C'::text
  GROUP BY um.user_code, um.user_name, ut.total_tasks_count, ut.completed_tasks_count, ut.to_do_tasks_count, ut.in_progress_tasks_count, ut.cancelled_tasks_count, ut.overdue_tasks_count, ust.total_subtasks_count, ust.completed_subtasks_count, ust.to_do_subtasks_count, ust.in_progress_subtasks_count, ust.cancelled_subtasks_count, ust.overdue_subtasks_count, dr.month_start, dr.week_start, dr.year_start, lr.leaves_taken, lr.permissions_taken
  ORDER BY um.user_name;

ALTER TABLE sts_ts.view_my_dashboard
    OWNER TO sts_ts;

