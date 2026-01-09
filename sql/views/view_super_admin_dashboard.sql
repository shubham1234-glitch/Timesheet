-- View: sts_ts.view_super_admin_dashboard

-- DROP VIEW sts_ts.view_super_admin_dashboard;

CREATE OR REPLACE VIEW sts_ts.view_super_admin_dashboard
 AS
 WITH epic_metrics AS (
         SELECT COALESCE(eh_latest.product_code, e.product_code) AS product_code,
            pm.product_name,
            count(*) AS total_epics,
            count(
                CASE
                    WHEN COALESCE(eh_latest.status_code, e.status_code)::text <> ALL (ARRAY['STS002'::text, 'STS010'::text]) THEN 1
                    ELSE NULL::integer
                END) AS active_epics,
            count(
                CASE
                    WHEN COALESCE(eh_latest.status_code, e.status_code)::text = ANY (ARRAY['STS002'::text, 'STS010'::text]) THEN 1
                    ELSE NULL::integer
                END) AS completed_epics,
            count(
                CASE
                    WHEN COALESCE(eh_latest.due_date, e.due_date) < CURRENT_DATE AND (COALESCE(eh_latest.status_code, e.status_code)::text <> ALL (ARRAY['STS002'::text, 'STS010'::text])) THEN 1
                    ELSE NULL::integer
                END) AS overdue_epics,
                CASE
                    WHEN count(*) > 0 THEN round(count(
                    CASE
                        WHEN COALESCE(eh_latest.status_code, e.status_code)::text = ANY (ARRAY['STS002'::text, 'STS010'::text]) THEN 1
                        ELSE NULL::integer
                    END)::numeric / count(*)::numeric * 100::numeric, 2)
                    ELSE 0::numeric
                END AS completion_rate_percentage,
            count(
                CASE
                    WHEN COALESCE(eh_latest.status_code, e.status_code)::text = 'STS007'::text THEN 1
                    ELSE NULL::integer
                END) AS status_in_progress_count,
            count(
                CASE
                    WHEN COALESCE(eh_latest.status_code, e.status_code)::text = 'STS002'::text THEN 1
                    ELSE NULL::integer
                END) AS status_done_count,
            count(
                CASE
                    WHEN COALESCE(eh_latest.status_code, e.status_code)::text = 'STS010'::text THEN 1
                    ELSE NULL::integer
                END) AS status_closed_count,
            count(
                CASE
                    WHEN COALESCE(eh_latest.status_code, e.status_code)::text <> ALL (ARRAY['STS002'::text, 'STS010'::text, 'STS007'::text, 'STS001'::text]) THEN 1
                    ELSE NULL::integer
                END) AS status_other_count
           FROM epics e
             LEFT JOIN LATERAL ( SELECT eh.id,
                    eh.epic_code,
                    eh.status_code,
                    eh.due_date,
                    eh.product_code,
                    eh.created_at
                   FROM epic_hist eh
                  WHERE eh.epic_code = e.id
                  ORDER BY eh.created_at DESC, eh.id DESC
                 LIMIT 1) eh_latest ON true
             LEFT JOIN sts_new.product_master pm ON COALESCE(eh_latest.product_code, e.product_code)::text = pm.product_code::text
          GROUP BY (COALESCE(eh_latest.product_code, e.product_code)), pm.product_name
        ), timesheet_metrics AS (
         SELECT te.epic_code,
            COALESCE(eh_latest.product_code, e.product_code) AS product_code,
            sum(te.total_hours) AS total_hours_worked,
            count(
                CASE
                    WHEN te.approval_status::text = ANY (ARRAY['DRAFT'::text, 'SUBMITTED'::text]) THEN 1
                    ELSE NULL::integer
                END) AS pending_approvals_count
           FROM timesheet_entry te
             JOIN epics e ON te.epic_code = e.id
             LEFT JOIN LATERAL ( SELECT eh.product_code
                   FROM epic_hist eh
                  WHERE eh.epic_code = e.id
                  ORDER BY eh.created_at DESC, eh.id DESC
                 LIMIT 1) eh_latest ON true
          WHERE te.task_code IS NOT NULL
          GROUP BY te.epic_code, (COALESCE(eh_latest.product_code, e.product_code))
        UNION ALL
         SELECT NULL::integer AS epic_code,
            a.product_code,
            sum(te.total_hours) AS total_hours_worked,
            count(
                CASE
                    WHEN te.approval_status::text = ANY (ARRAY['DRAFT'::text, 'SUBMITTED'::text]) THEN 1
                    ELSE NULL::integer
                END) AS pending_approvals_count
           FROM timesheet_entry te
             JOIN activities a ON te.activity_code = a.id
          WHERE te.activity_code IS NOT NULL
          GROUP BY a.product_code
        ), hours_by_epic AS (
         SELECT tm.product_code,
            e.id AS epic_id,
            e.epic_title,
            NULL::integer AS activity_id,
            NULL::text AS activity_title,
            COALESCE(tm.total_hours_worked, 0::numeric) AS total_hours
           FROM epics e
             LEFT JOIN timesheet_metrics tm ON e.id = tm.epic_code AND tm.epic_code IS NOT NULL
        UNION ALL
         SELECT tm.product_code,
            NULL::integer AS epic_id,
            NULL::text AS epic_title,
            NULL::integer AS activity_id,
            'Activities'::text AS activity_title,
            COALESCE(tm.total_hours_worked, 0::numeric) AS total_hours
           FROM timesheet_metrics tm
          WHERE tm.epic_code IS NULL
        ), product_pending_approvals AS (
         SELECT combined.product_code,
            sum(combined.total_pending) AS total_pending_approvals
           FROM ( SELECT COALESCE(eh_latest.product_code, e.product_code) AS product_code,
                    sum(
                        CASE
                            WHEN te.approval_status::text = ANY (ARRAY['DRAFT'::text, 'SUBMITTED'::text]) THEN 1
                            ELSE 0
                        END) AS total_pending
                   FROM timesheet_entry te
                     JOIN epics e ON te.epic_code = e.id
                     LEFT JOIN LATERAL ( SELECT eh.product_code
                           FROM epic_hist eh
                          WHERE eh.epic_code = e.id
                          ORDER BY eh.created_at DESC, eh.id DESC
                         LIMIT 1) eh_latest ON true
                  WHERE te.task_code IS NOT NULL
                  GROUP BY (COALESCE(eh_latest.product_code, e.product_code))
                UNION ALL
                 SELECT a.product_code,
                    sum(
                        CASE
                            WHEN te.approval_status::text = ANY (ARRAY['DRAFT'::text, 'SUBMITTED'::text]) THEN 1
                            ELSE 0
                        END) AS total_pending
                   FROM timesheet_entry te
                     JOIN activities a ON te.activity_code = a.id
                  WHERE te.activity_code IS NOT NULL
                  GROUP BY a.product_code) combined
          GROUP BY combined.product_code
        )
 SELECT em.product_code,
    em.product_name,
    em.total_epics,
    em.active_epics,
    em.completed_epics,
    em.overdue_epics,
    em.completion_rate_percentage,
    em.status_in_progress_count,
    em.status_done_count,
    em.status_closed_count,
    em.status_other_count,
    COALESCE(ppa.total_pending_approvals, 0::bigint::numeric) AS pending_approvals,
    COALESCE(( SELECT json_agg(json_build_object('epic_id', hbe.epic_id, 'epic_title', hbe.epic_title, 'activity_id', hbe.activity_id, 'activity_title', hbe.activity_title, 'entry_type',
                CASE
                    WHEN hbe.epic_id IS NOT NULL THEN 'EPIC'::text
                    ELSE 'ACTIVITY'::text
                END, 'total_hours', round(hbe.total_hours, 2)) ORDER BY hbe.total_hours DESC) AS json_agg
           FROM hours_by_epic hbe
          WHERE hbe.product_code::text = em.product_code::text AND hbe.total_hours > 0::numeric
         LIMIT 5), '[]'::json) AS top_5_epics_by_hours,
    COALESCE(( SELECT json_agg(json_build_object('status_code', status_distribution.status_code, 'status_description', status_distribution.status_description, 'count', status_distribution.status_count) ORDER BY status_distribution.status_count DESC) AS json_agg
           FROM ( SELECT 'STS007'::text AS status_code,
                    'In Progress'::text AS status_description,
                    em.status_in_progress_count AS status_count
                UNION ALL
                 SELECT 'STS002'::text AS status_code,
                    'Done'::text AS status_description,
                    em.status_done_count AS status_count
                UNION ALL
                 SELECT 'STS010'::text AS status_code,
                    'Closed'::text AS status_description,
                    em.status_closed_count AS status_count) status_distribution
          WHERE status_distribution.status_count > 0), '[]'::json) AS epic_status_distribution
   FROM epic_metrics em
     LEFT JOIN product_pending_approvals ppa ON em.product_code::text = ppa.product_code::text
  ORDER BY em.product_name;

ALTER TABLE sts_ts.view_super_admin_dashboard
    OWNER TO sts_ts;
COMMENT ON VIEW sts_ts.view_super_admin_dashboard
    IS 'Super Admin Dashboard view providing aggregated epic and timesheet metrics by product. Includes: total epics, active/completed/overdue counts, completion rate, status distribution, pending approvals, and top 5 epics by hours worked. Filter by product_code to get metrics for a specific product.';

GRANT ALL ON TABLE sts_ts.view_super_admin_dashboard TO sts_ts;
GRANT SELECT ON TABLE sts_ts.view_super_admin_dashboard TO sukraa_analyst;
GRANT SELECT ON TABLE sts_ts.view_super_admin_dashboard TO sukraa_dev;

