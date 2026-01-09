-- View: sts_ts.view_recent_activities

-- DROP VIEW sts_ts.view_recent_activities;

CREATE OR REPLACE VIEW sts_ts.view_recent_activities
 AS
 WITH epic_status_activities AS (
         SELECT eh.epic_code,
            e.epic_title,
            e.epic_description,
            eh.epic_code AS entity_code,
            'EPIC'::text AS entity_type,
                CASE
                    WHEN lower(TRIM(BOTH FROM sm.status_desc::text)) = 'not yet started'::text THEN 'To Do'::text::character varying
                    ELSE sm.status_desc
                END AS status_desc,
            NULL::character varying AS assignee,
            eh.created_at,
            eh.created_by,
                CASE
                    WHEN lower(TRIM(BOTH FROM sm.status_desc::text)) = 'not yet started'::text THEN 'TO_DO'::text
                    WHEN lower(TRIM(BOTH FROM sm.status_desc::text)) = 'in progress'::text THEN 'IN_PROGRESS'::text
                    WHEN lower(TRIM(BOTH FROM sm.status_desc::text)) = ANY (ARRAY['completed'::text, 'closed'::text]) THEN 'DONE'::text
                    WHEN lower(TRIM(BOTH FROM sm.status_desc::text)) = ANY (ARRAY['cancelled'::text, 'canceled'::text]) THEN 'BLOCKED'::text
                    ELSE 'STATUS_CHANGE'::text
                END AS activity_type,
                CASE
                    WHEN lower(TRIM(BOTH FROM sm.status_desc::text)) = 'not yet started'::text THEN ('Epic #'::text || e.id::text) || ' status changed to To Do'::text
                    WHEN lower(TRIM(BOTH FROM sm.status_desc::text)) = 'in progress'::text THEN ('Epic #'::text || e.id::text) || ' started'::text
                    WHEN lower(TRIM(BOTH FROM sm.status_desc::text)) = ANY (ARRAY['completed'::text, 'closed'::text]) THEN ('Epic #'::text || e.id::text) || ' completed'::text
                    WHEN lower(TRIM(BOTH FROM sm.status_desc::text)) = ANY (ARRAY['cancelled'::text, 'canceled'::text]) THEN ('Epic #'::text || e.id::text) || ' blocked'::text
                    ELSE (('Epic #'::text || e.id::text) || ' status changed to '::text) || sm.status_desc::text
                END AS activity_description,
            e.epic_title AS entity_title,
            e.epic_description AS entity_description,
            NULL::integer AS task_id,
            NULL::character varying AS task_title
           FROM epic_hist eh
             JOIN sts_new.status_master sm ON eh.status_code::text = sm.status_code::text
             JOIN epics e ON eh.epic_code = e.id
             LEFT JOIN LATERAL ( SELECT eh_prev.status_code
                   FROM epic_hist eh_prev
                  WHERE eh_prev.epic_code = eh.epic_code AND (eh_prev.created_at < eh.created_at OR eh_prev.created_at = eh.created_at AND eh_prev.id < eh.id)
                  ORDER BY eh_prev.created_at DESC, eh_prev.id DESC
                 LIMIT 1) prev_hist ON true
          WHERE e.id IS NOT NULL AND (prev_hist.status_code IS NULL OR prev_hist.status_code::text <> eh.status_code::text)
        ), task_status_activities AS (
         SELECT t.epic_code,
            e.epic_title,
            e.epic_description,
            th.task_code AS entity_code,
            'TASK'::text AS entity_type,
                CASE
                    WHEN lower(TRIM(BOTH FROM sm.status_desc::text)) = 'not yet started'::text THEN 'To Do'::text::character varying
                    ELSE sm.status_desc
                END AS status_desc,
            th.assignee,
            th.created_at,
            th.created_by,
                CASE
                    WHEN lower(TRIM(BOTH FROM sm.status_desc::text)) = 'not yet started'::text THEN 'TO_DO'::text
                    WHEN lower(TRIM(BOTH FROM sm.status_desc::text)) = 'in progress'::text THEN 'IN_PROGRESS'::text
                    WHEN lower(TRIM(BOTH FROM sm.status_desc::text)) = ANY (ARRAY['completed'::text, 'closed'::text]) THEN 'DONE'::text
                    WHEN lower(TRIM(BOTH FROM sm.status_desc::text)) = ANY (ARRAY['cancelled'::text, 'canceled'::text]) THEN 'BLOCKED'::text
                    ELSE 'STATUS_CHANGE'::text
                END AS activity_type,
                CASE
                    WHEN lower(TRIM(BOTH FROM sm.status_desc::text)) = 'not yet started'::text AND th.assignee IS NOT NULL AND th.assignee::text = th.created_by::text THEN ('Task #'::text || t.id::text) || ' assigned to self'::text
                    WHEN lower(TRIM(BOTH FROM sm.status_desc::text)) = 'not yet started'::text AND th.assignee IS NOT NULL THEN ('Task #'::text || t.id::text) || ' assigned'::text
                    WHEN lower(TRIM(BOTH FROM sm.status_desc::text)) = 'not yet started'::text THEN ('Task #'::text || t.id::text) || ' created'::text
                    WHEN lower(TRIM(BOTH FROM sm.status_desc::text)) = 'in progress'::text THEN ('Task #'::text || t.id::text) || ' started'::text
                    WHEN lower(TRIM(BOTH FROM sm.status_desc::text)) = ANY (ARRAY['completed'::text, 'closed'::text]) THEN ('Task #'::text || t.id::text) || ' completed'::text
                    WHEN lower(TRIM(BOTH FROM sm.status_desc::text)) = ANY (ARRAY['cancelled'::text, 'canceled'::text]) THEN ('Task #'::text || t.id::text) || ' blocked'::text
                    ELSE (('Task #'::text || t.id::text) || ' status changed to '::text) || sm.status_desc::text
                END AS activity_description,
            t.task_title AS entity_title,
            t.description AS entity_description,
            t.id AS task_id,
            t.task_title,
            COALESCE(th.task_type_code, t.task_type_code) AS task_type_code
           FROM task_hist th
             JOIN sts_new.status_master sm ON th.status_code::text = sm.status_code::text
             JOIN tasks t ON th.task_code = t.id
             JOIN epics e ON t.epic_code = e.id
             LEFT JOIN LATERAL ( SELECT th_prev.status_code
                   FROM task_hist th_prev
                  WHERE th_prev.task_code = th.task_code AND (th_prev.created_at < th.created_at OR th_prev.created_at = th.created_at AND th_prev.id < th.id)
                  ORDER BY th_prev.created_at DESC, th_prev.id DESC
                 LIMIT 1) prev_hist ON true
          WHERE th.status_code IS NOT NULL AND (prev_hist.status_code IS NULL OR prev_hist.status_code::text <> th.status_code::text)
        ), epic_creation_activities AS (
         SELECT e.id AS epic_code,
            e.epic_title,
            e.epic_description,
            e.id AS entity_code,
            'EPIC'::text AS entity_type,
            'Created'::text AS status_desc,
            NULL::character varying AS assignee,
            e.created_at,
            e.created_by,
            'CREATED'::text AS activity_type,
            ('Epic #'::text || e.id::text) || ' created'::text AS activity_description,
            e.epic_title AS entity_title,
            e.epic_description AS entity_description,
            NULL::integer AS task_id,
            NULL::character varying AS task_title
           FROM epics e
          WHERE NOT (EXISTS ( SELECT 1
                   FROM epic_hist eh
                  WHERE eh.epic_code = e.id AND eh.created_at < e.created_at))
        ), task_creation_activities AS (
         SELECT t.epic_code,
            e.epic_title,
            e.epic_description,
            t.id AS entity_code,
            'TASK'::text AS entity_type,
            'Created'::text AS status_desc,
            t.assignee,
            t.created_at,
            t.created_by,
            'CREATED'::text AS activity_type,
            ('Task #'::text || t.id::text) || ' created'::text AS activity_description,
            t.task_title AS entity_title,
            t.description AS entity_description,
            t.id AS task_id,
            t.task_title,
            t.task_type_code
           FROM tasks t
             JOIN epics e ON t.epic_code = e.id
          WHERE NOT (EXISTS ( SELECT 1
                   FROM task_hist th
                  WHERE th.task_code = t.id AND th.created_at < t.created_at)) AND NOT (EXISTS ( SELECT 1
                   FROM task_hist th2
                     JOIN sts_new.status_master sm2 ON th2.status_code::text = sm2.status_code::text
                  WHERE th2.task_code = t.id AND lower(TRIM(BOTH FROM sm2.status_desc::text)) = 'not yet started'::text AND abs(EXTRACT(epoch FROM th2.created_at - t.created_at)) < 5::numeric))
        ), comment_activities AS (
         SELECT
                CASE
                    WHEN c.parent_type::text = 'TASK'::text AND t.id IS NOT NULL THEN t.epic_code
                    WHEN c.parent_type::text = 'TASK'::text AND t.id IS NULL THEN NULL::integer
                    WHEN c.parent_type::text = 'EPIC'::text AND e2.id IS NOT NULL THEN e2.id
                    WHEN c.parent_type::text = 'EPIC'::text AND e2.id IS NULL THEN NULL::integer
                    ELSE NULL::integer
                END AS epic_code,
                CASE
                    WHEN c.parent_type::text = 'TASK'::text AND t.id IS NOT NULL THEN e.epic_title
                    WHEN c.parent_type::text = 'TASK'::text AND t.id IS NULL THEN NULL::character varying
                    WHEN c.parent_type::text = 'EPIC'::text AND e2.id IS NOT NULL THEN e2.epic_title
                    WHEN c.parent_type::text = 'EPIC'::text AND e2.id IS NULL THEN NULL::character varying
                    ELSE NULL::character varying
                END AS epic_title,
                CASE
                    WHEN c.parent_type::text = 'TASK'::text AND t.id IS NOT NULL THEN e.epic_description
                    WHEN c.parent_type::text = 'TASK'::text AND t.id IS NULL THEN NULL::text
                    WHEN c.parent_type::text = 'EPIC'::text AND e2.id IS NOT NULL THEN e2.epic_description
                    WHEN c.parent_type::text = 'EPIC'::text AND e2.id IS NULL THEN NULL::text
                    ELSE NULL::text
                END AS epic_description,
            c.parent_code AS entity_code,
            c.parent_type AS entity_type,
            'Commented'::text AS status_desc,
            c.commented_by AS assignee,
            c.commented_at AS created_at,
            c.commented_by AS created_by,
            'COMMENTED'::text AS activity_type,
                CASE
                    WHEN c.parent_type::text = 'TASK'::text AND t.id IS NOT NULL THEN ('Task #'::text || t.id::text) || ' commented'::text
                    WHEN c.parent_type::text = 'TASK'::text AND t.id IS NULL THEN ('Task #'::text || c.parent_code::text) || ' commented'::text
                    WHEN c.parent_type::text = 'EPIC'::text AND e2.id IS NOT NULL THEN ('Epic #'::text || e2.id::text) || ' commented'::text
                    WHEN c.parent_type::text = 'EPIC'::text AND e2.id IS NULL THEN ('Epic #'::text || c.parent_code::text) || ' commented'::text
                    ELSE ('Entry #'::text || c.parent_code::text) || ' commented'::text
                END AS activity_description,
                CASE
                    WHEN c.parent_type::text = 'TASK'::text THEN COALESCE(t.task_title, 'Unknown Task'::text::character varying)
                    WHEN c.parent_type::text = 'EPIC'::text THEN COALESCE(e2.epic_title, 'Unknown Epic'::text::character varying)
                    ELSE NULL::character varying
                END AS entity_title,
                CASE
                    WHEN c.parent_type::text = 'TASK'::text THEN COALESCE(t.description, ''::text)
                    WHEN c.parent_type::text = 'EPIC'::text THEN COALESCE(e2.epic_description, ''::text)
                    ELSE NULL::text
                END AS entity_description,
                CASE
                    WHEN c.parent_type::text = 'TASK'::text THEN t.id
                    ELSE NULL::integer
                END AS task_id,
                CASE
                    WHEN c.parent_type::text = 'TASK'::text THEN COALESCE(t.task_title, 'Unknown Task'::text::character varying)
                    ELSE NULL::character varying
                END AS task_title,
                CASE
                    WHEN c.parent_type::text = 'TASK'::text THEN t.task_type_code
                    ELSE NULL::character varying
                END AS task_type_code
           FROM comments c
             LEFT JOIN tasks t ON c.parent_type::text = 'TASK'::text AND c.parent_code = t.id
             LEFT JOIN epics e ON t.epic_code = e.id
             LEFT JOIN epics e2 ON c.parent_type::text = 'EPIC'::text AND c.parent_code = e2.id
          WHERE c.parent_type::text = 'TASK'::text AND t.id IS NOT NULL OR c.parent_type::text = 'EPIC'::text AND e2.id IS NOT NULL OR (c.parent_type::text <> ALL (ARRAY['TASK'::text, 'EPIC'::text]))
        ), task_cancellation_activities AS (
         SELECT t.epic_code,
            e.epic_title,
            e.epic_description,
            t.id AS entity_code,
            'TASK'::text AS entity_type,
            'Cancelled'::text AS status_desc,
            t.cancelled_by AS assignee,
            t.cancelled_at::timestamp without time zone AS created_at,
            t.cancelled_by AS created_by,
            'BLOCKED'::text AS activity_type,
            ('Task #'::text || t.id::text) || ' blocked'::text AS activity_description,
            t.task_title AS entity_title,
            t.description AS entity_description,
            t.id AS task_id,
            t.task_title,
            t.task_type_code
           FROM tasks t
             JOIN epics e ON t.epic_code = e.id
          WHERE t.cancelled_by IS NOT NULL
        ), epic_cancellation_activities AS (
         SELECT e.id AS epic_code,
            e.epic_title,
            e.epic_description,
            e.id AS entity_code,
            'EPIC'::text AS entity_type,
            'Cancelled'::text AS status_desc,
            e.cancelled_by AS assignee,
            e.cancelled_at::timestamp without time zone AS created_at,
            e.cancelled_by AS created_by,
            'BLOCKED'::text AS activity_type,
            ('Epic #'::text || e.id::text) || ' blocked'::text AS activity_description,
            e.epic_title AS entity_title,
            e.epic_description AS entity_description,
            NULL::integer AS task_id,
            NULL::character varying AS task_title
           FROM epics e
          WHERE e.cancelled_by IS NOT NULL
        ), epic_priority_activities AS (
         SELECT eh.epic_code,
            e.epic_title,
            e.epic_description,
            eh.epic_code AS entity_code,
            'EPIC'::text AS entity_type,
            'Priority changed to '::text || COALESCE(pr.priority_desc, 'Unknown'::text::character varying)::text AS status_desc,
            NULL::character varying AS assignee,
            eh.created_at,
            eh.created_by,
            'PRIORITY_CHANGE'::text AS activity_type,
            (('Epic #'::text || e.id::text) || ' priority changed to '::text) || COALESCE(pr.priority_desc, 'Unknown'::text::character varying)::text AS activity_description,
            e.epic_title AS entity_title,
            e.epic_description AS entity_description,
            NULL::integer AS task_id,
            NULL::character varying AS task_title
           FROM epic_hist eh
             JOIN epics e ON eh.epic_code = e.id
             LEFT JOIN sts_new.tkt_priority_master pr ON eh.priority_code = pr.priority_code
             LEFT JOIN LATERAL ( SELECT eh_prev.priority_code
                   FROM epic_hist eh_prev
                  WHERE eh_prev.epic_code = eh.epic_code AND (eh_prev.created_at < eh.created_at OR eh_prev.created_at = eh.created_at AND eh_prev.id < eh.id)
                  ORDER BY eh_prev.created_at DESC, eh_prev.id DESC
                 LIMIT 1) prev_hist ON true
          WHERE e.id IS NOT NULL AND eh.priority_code IS NOT NULL AND prev_hist.priority_code IS NOT NULL AND prev_hist.priority_code <> eh.priority_code
        ), task_priority_activities AS (
         SELECT t.epic_code,
            e.epic_title,
            e.epic_description,
            th.task_code AS entity_code,
            'TASK'::text AS entity_type,
            'Priority changed to '::text || COALESCE(pr.priority_desc, 'Unknown'::text::character varying)::text AS status_desc,
            th.assignee,
            th.created_at,
            th.created_by,
            'PRIORITY_CHANGE'::text AS activity_type,
            (('Task #'::text || t.id::text) || ' priority changed to '::text) || COALESCE(pr.priority_desc, 'Unknown'::text::character varying)::text AS activity_description,
            t.task_title AS entity_title,
            t.description AS entity_description,
            t.id AS task_id,
            t.task_title,
            COALESCE(th.task_type_code, t.task_type_code) AS task_type_code
           FROM task_hist th
             JOIN tasks t ON th.task_code = t.id
             JOIN epics e ON t.epic_code = e.id
             LEFT JOIN sts_new.tkt_priority_master pr ON th.priority_code = pr.priority_code
             LEFT JOIN LATERAL ( SELECT th_prev.priority_code
                   FROM task_hist th_prev
                  WHERE th_prev.task_code = th.task_code AND (th_prev.created_at < th.created_at OR th_prev.created_at = th.created_at AND th_prev.id < th.id)
                  ORDER BY th_prev.created_at DESC, th_prev.id DESC
                 LIMIT 1) prev_hist ON true
          WHERE th.priority_code IS NOT NULL AND prev_hist.priority_code IS NOT NULL AND prev_hist.priority_code <> th.priority_code
        ), epic_start_date_activities AS (
         SELECT eh.epic_code,
            e.epic_title,
            e.epic_description,
            eh.epic_code AS entity_code,
            'EPIC'::text AS entity_type,
            'Start date changed to '::text || to_char(eh.start_date::timestamp with time zone, 'DD-MM-YYYY'::text) AS status_desc,
            NULL::character varying AS assignee,
            eh.created_at,
            eh.created_by,
            'DATE_CHANGE'::text AS activity_type,
            (('Epic #'::text || e.id::text) || ' start date changed to '::text) || to_char(eh.start_date::timestamp with time zone, 'DD-MM-YYYY'::text) AS activity_description,
            e.epic_title AS entity_title,
            e.epic_description AS entity_description,
            NULL::integer AS task_id,
            NULL::character varying AS task_title
           FROM epic_hist eh
             JOIN epics e ON eh.epic_code = e.id
             LEFT JOIN LATERAL ( SELECT eh_prev.start_date
                   FROM epic_hist eh_prev
                  WHERE eh_prev.epic_code = eh.epic_code AND (eh_prev.created_at < eh.created_at OR eh_prev.created_at = eh.created_at AND eh_prev.id < eh.id)
                  ORDER BY eh_prev.created_at DESC, eh_prev.id DESC
                 LIMIT 1) prev_hist ON true
          WHERE e.id IS NOT NULL AND eh.start_date IS NOT NULL AND prev_hist.start_date IS NOT NULL AND prev_hist.start_date <> eh.start_date
        ), epic_due_date_activities AS (
         SELECT eh.epic_code,
            e.epic_title,
            e.epic_description,
            eh.epic_code AS entity_code,
            'EPIC'::text AS entity_type,
            'Due date changed to '::text || to_char(eh.due_date::timestamp with time zone, 'DD-MM-YYYY'::text) AS status_desc,
            NULL::character varying AS assignee,
            eh.created_at,
            eh.created_by,
            'DATE_CHANGE'::text AS activity_type,
            (('Epic #'::text || e.id::text) || ' due date changed to '::text) || to_char(eh.due_date::timestamp with time zone, 'DD-MM-YYYY'::text) AS activity_description,
            e.epic_title AS entity_title,
            e.epic_description AS entity_description,
            NULL::integer AS task_id,
            NULL::character varying AS task_title
           FROM epic_hist eh
             JOIN epics e ON eh.epic_code = e.id
             LEFT JOIN LATERAL ( SELECT eh_prev.due_date
                   FROM epic_hist eh_prev
                  WHERE eh_prev.epic_code = eh.epic_code AND (eh_prev.created_at < eh.created_at OR eh_prev.created_at = eh.created_at AND eh_prev.id < eh.id)
                  ORDER BY eh_prev.created_at DESC, eh_prev.id DESC
                 LIMIT 1) prev_hist ON true
          WHERE e.id IS NOT NULL AND eh.due_date IS NOT NULL AND prev_hist.due_date IS NOT NULL AND prev_hist.due_date <> eh.due_date
        ), epic_estimated_hours_activities AS (
         SELECT eh.epic_code,
            e.epic_title,
            e.epic_description,
            eh.epic_code AS entity_code,
            'EPIC'::text AS entity_type,
            'Estimated hours changed to '::text || eh.estimated_hours::text AS status_desc,
            NULL::character varying AS assignee,
            eh.created_at,
            eh.created_by,
            'HOURS_CHANGE'::text AS activity_type,
            (('Epic #'::text || e.id::text) || ' estimated hours changed to '::text) || eh.estimated_hours::text AS activity_description,
            e.epic_title AS entity_title,
            e.epic_description AS entity_description,
            NULL::integer AS task_id,
            NULL::character varying AS task_title
           FROM epic_hist eh
             JOIN epics e ON eh.epic_code = e.id
             LEFT JOIN LATERAL ( SELECT eh_prev.estimated_hours
                   FROM epic_hist eh_prev
                  WHERE eh_prev.epic_code = eh.epic_code AND (eh_prev.created_at < eh.created_at OR eh_prev.created_at = eh.created_at AND eh_prev.id < eh.id)
                  ORDER BY eh_prev.created_at DESC, eh_prev.id DESC
                 LIMIT 1) prev_hist ON true
          WHERE e.id IS NOT NULL AND eh.estimated_hours IS NOT NULL AND prev_hist.estimated_hours IS NOT NULL AND prev_hist.estimated_hours <> eh.estimated_hours
        ), epic_product_activities AS (
         SELECT eh.epic_code,
            e.epic_title,
            e.epic_description,
            eh.epic_code AS entity_code,
            'EPIC'::text AS entity_type,
            'Product changed to '::text || COALESCE(pm.product_name, eh.product_code, 'Unknown'::text::character varying)::text AS status_desc,
            NULL::character varying AS assignee,
            eh.created_at,
            eh.created_by,
            'PRODUCT_CHANGE'::text AS activity_type,
            (('Epic #'::text || e.id::text) || ' product changed to '::text) || COALESCE(pm.product_name, eh.product_code, 'Unknown'::text::character varying)::text AS activity_description,
            e.epic_title AS entity_title,
            e.epic_description AS entity_description,
            NULL::integer AS task_id,
            NULL::character varying AS task_title
           FROM epic_hist eh
             JOIN epics e ON eh.epic_code = e.id
             LEFT JOIN sts_new.product_master pm ON eh.product_code::text = pm.product_code::text
             LEFT JOIN LATERAL ( SELECT eh_prev.product_code
                   FROM epic_hist eh_prev
                  WHERE eh_prev.epic_code = eh.epic_code AND (eh_prev.created_at < eh.created_at OR eh_prev.created_at = eh.created_at AND eh_prev.id < eh.id)
                  ORDER BY eh_prev.created_at DESC, eh_prev.id DESC
                 LIMIT 1) prev_hist ON true
          WHERE e.id IS NOT NULL AND eh.product_code IS NOT NULL AND prev_hist.product_code IS NOT NULL AND prev_hist.product_code::text <> eh.product_code::text
        ), task_assignee_activities AS (
         SELECT t.epic_code,
            e.epic_title,
            e.epic_description,
            th.task_code AS entity_code,
            'TASK'::text AS entity_type,
                CASE
                    WHEN th.assignee::text = th.created_by::text THEN 'Assigned to self'::text
                    WHEN prev_hist.assignee IS NULL THEN 'Assigned to '::text || COALESCE(um_assignee_1.user_name, th.assignee, 'Unknown'::text::character varying)::text
                    ELSE 'Assignee changed to '::text || COALESCE(um_assignee_1.user_name, th.assignee, 'Unknown'::text::character varying)::text
                END AS status_desc,
            th.assignee,
            th.created_at,
            th.created_by,
            'ASSIGNEE_CHANGE'::text AS activity_type,
                CASE
                    WHEN th.assignee::text = th.created_by::text THEN ('Task #'::text || t.id::text) || ' assigned to self'::text
                    WHEN prev_hist.assignee IS NULL THEN (('Task #'::text || t.id::text) || ' assigned to '::text) || COALESCE(um_assignee_1.user_name, th.assignee, 'Unknown'::text::character varying)::text
                    ELSE (('Task #'::text || t.id::text) || ' assignee changed to '::text) || COALESCE(um_assignee_1.user_name, th.assignee, 'Unknown'::text::character varying)::text
                END AS activity_description,
            t.task_title AS entity_title,
            t.description AS entity_description,
            t.id AS task_id,
            t.task_title,
            COALESCE(th.task_type_code, t.task_type_code) AS task_type_code
           FROM task_hist th
             JOIN tasks t ON th.task_code = t.id
             JOIN epics e ON t.epic_code = e.id
             LEFT JOIN sts_new.user_master um_assignee_1 ON th.assignee::text = um_assignee_1.user_code::text
             LEFT JOIN LATERAL ( SELECT th_prev.assignee
                   FROM task_hist th_prev
                  WHERE th_prev.task_code = th.task_code AND (th_prev.created_at < th.created_at OR th_prev.created_at = th.created_at AND th_prev.id < th.id)
                  ORDER BY th_prev.created_at DESC, th_prev.id DESC
                 LIMIT 1) prev_hist ON true
          WHERE th.assignee IS NOT NULL AND (prev_hist.assignee IS NULL OR prev_hist.assignee::text <> th.assignee::text) AND NOT (EXISTS ( SELECT 1
                   FROM tasks t_check
                  WHERE t_check.id = th.task_code AND abs(EXTRACT(epoch FROM th.created_at - t_check.created_at)) < 5::numeric AND (EXISTS ( SELECT 1
                           FROM task_hist th_status
                             JOIN sts_new.status_master sm_status ON th_status.status_code::text = sm_status.status_code::text
                          WHERE th_status.task_code = t_check.id AND lower(TRIM(BOTH FROM sm_status.status_desc::text)) = 'not yet started'::text AND th_status.assignee IS NOT NULL AND abs(EXTRACT(epoch FROM th_status.created_at - t_check.created_at)) < 5::numeric))))
        ), epic_assignee_activities AS (
         SELECT eh.epic_code,
            e.epic_title,
            e.epic_description,
            eh.epic_code AS entity_code,
            'EPIC'::text AS entity_type,
            'Assignee changed to '::text || COALESCE(um_user.user_name, eh.user_code, 'Unknown'::text::character varying)::text AS status_desc,
            NULL::character varying AS assignee,
            eh.created_at,
            eh.created_by,
            'ASSIGNEE_CHANGE'::text AS activity_type,
            (('Epic #'::text || e.id::text) || ' assignee changed to '::text) || COALESCE(um_user.user_name, eh.user_code, 'Unknown'::text::character varying)::text AS activity_description,
            e.epic_title AS entity_title,
            e.epic_description AS entity_description,
            NULL::integer AS task_id,
            NULL::character varying AS task_title
           FROM epic_hist eh
             JOIN epics e ON eh.epic_code = e.id
             LEFT JOIN sts_new.user_master um_user ON eh.user_code::text = um_user.user_code::text
             LEFT JOIN LATERAL ( SELECT eh_prev.user_code
                   FROM epic_hist eh_prev
                  WHERE eh_prev.epic_code = eh.epic_code AND (eh_prev.created_at < eh.created_at OR eh_prev.created_at = eh.created_at AND eh_prev.id < eh.id)
                  ORDER BY eh_prev.created_at DESC, eh_prev.id DESC
                 LIMIT 1) prev_hist ON true
          WHERE e.id IS NOT NULL AND eh.user_code IS NOT NULL AND prev_hist.user_code IS NOT NULL AND prev_hist.user_code::text <> eh.user_code::text
        ), task_start_date_activities AS (
         SELECT t.epic_code,
            e.epic_title,
            e.epic_description,
            th.task_code AS entity_code,
            'TASK'::text AS entity_type,
            'Start date changed to '::text || to_char(th.start_date::timestamp with time zone, 'DD-MM-YYYY'::text) AS status_desc,
            th.assignee,
            th.created_at,
            th.created_by,
            'DATE_CHANGE'::text AS activity_type,
            (('Task #'::text || t.id::text) || ' start date changed to '::text) || to_char(th.start_date::timestamp with time zone, 'DD-MM-YYYY'::text) AS activity_description,
            t.task_title AS entity_title,
            t.description AS entity_description,
            t.id AS task_id,
            t.task_title,
            COALESCE(th.task_type_code, t.task_type_code) AS task_type_code
           FROM task_hist th
             JOIN tasks t ON th.task_code = t.id
             JOIN epics e ON t.epic_code = e.id
             LEFT JOIN LATERAL ( SELECT th_prev.start_date
                   FROM task_hist th_prev
                  WHERE th_prev.task_code = th.task_code AND (th_prev.created_at < th.created_at OR th_prev.created_at = th.created_at AND th_prev.id < th.id)
                  ORDER BY th_prev.created_at DESC, th_prev.id DESC
                 LIMIT 1) prev_hist ON true
          WHERE th.start_date IS NOT NULL AND prev_hist.start_date IS NOT NULL AND prev_hist.start_date <> th.start_date
        ), task_due_date_activities AS (
         SELECT t.epic_code,
            e.epic_title,
            e.epic_description,
            th.task_code AS entity_code,
            'TASK'::text AS entity_type,
            'Due date changed to '::text || to_char(th.due_date::timestamp with time zone, 'DD-MM-YYYY'::text) AS status_desc,
            th.assignee,
            th.created_at,
            th.created_by,
            'DATE_CHANGE'::text AS activity_type,
            (('Task #'::text || t.id::text) || ' due date changed to '::text) || to_char(th.due_date::timestamp with time zone, 'DD-MM-YYYY'::text) AS activity_description,
            t.task_title AS entity_title,
            t.description AS entity_description,
            t.id AS task_id,
            t.task_title,
            COALESCE(th.task_type_code, t.task_type_code) AS task_type_code
           FROM task_hist th
             JOIN tasks t ON th.task_code = t.id
             JOIN epics e ON t.epic_code = e.id
             LEFT JOIN LATERAL ( SELECT th_prev.due_date
                   FROM task_hist th_prev
                  WHERE th_prev.task_code = th.task_code AND (th_prev.created_at < th.created_at OR th_prev.created_at = th.created_at AND th_prev.id < th.id)
                  ORDER BY th_prev.created_at DESC, th_prev.id DESC
                 LIMIT 1) prev_hist ON true
          WHERE th.due_date IS NOT NULL AND prev_hist.due_date IS NOT NULL AND prev_hist.due_date <> th.due_date
        ), task_estimated_hours_activities AS (
         SELECT t.epic_code,
            e.epic_title,
            e.epic_description,
            th.task_code AS entity_code,
            'TASK'::text AS entity_type,
            'Estimated hours changed to '::text || th.estimated_hours::text AS status_desc,
            th.assignee,
            th.created_at,
            th.created_by,
            'HOURS_CHANGE'::text AS activity_type,
            (('Task #'::text || t.id::text) || ' estimated hours changed to '::text) || th.estimated_hours::text AS activity_description,
            t.task_title AS entity_title,
            t.description AS entity_description,
            t.id AS task_id,
            t.task_title,
            COALESCE(th.task_type_code, t.task_type_code) AS task_type_code
           FROM task_hist th
             JOIN tasks t ON th.task_code = t.id
             JOIN epics e ON t.epic_code = e.id
             LEFT JOIN LATERAL ( SELECT th_prev.estimated_hours
                   FROM task_hist th_prev
                  WHERE th_prev.task_code = th.task_code AND (th_prev.created_at < th.created_at OR th_prev.created_at = th.created_at AND th_prev.id < th.id)
                  ORDER BY th_prev.created_at DESC, th_prev.id DESC
                 LIMIT 1) prev_hist ON true
          WHERE th.estimated_hours IS NOT NULL AND prev_hist.estimated_hours IS NOT NULL AND prev_hist.estimated_hours <> th.estimated_hours
        ), task_estimated_days_activities AS (
         SELECT t.epic_code,
            e.epic_title,
            e.epic_description,
            th.task_code AS entity_code,
            'TASK'::text AS entity_type,
            'Estimated days changed to '::text || th.estimated_days::text AS status_desc,
            th.assignee,
            th.created_at,
            th.created_by,
            'DAYS_CHANGE'::text AS activity_type,
            (('Task #'::text || t.id::text) || ' estimated days changed to '::text) || th.estimated_days::text AS activity_description,
            t.task_title AS entity_title,
            t.description AS entity_description,
            t.id AS task_id,
            t.task_title,
            COALESCE(th.task_type_code, t.task_type_code) AS task_type_code
           FROM task_hist th
             JOIN tasks t ON th.task_code = t.id
             JOIN epics e ON t.epic_code = e.id
             LEFT JOIN LATERAL ( SELECT th_prev.estimated_days
                   FROM task_hist th_prev
                  WHERE th_prev.task_code = th.task_code AND (th_prev.created_at < th.created_at OR th_prev.created_at = th.created_at AND th_prev.id < th.id)
                  ORDER BY th_prev.created_at DESC, th_prev.id DESC
                 LIMIT 1) prev_hist ON true
          WHERE th.estimated_days IS NOT NULL AND prev_hist.estimated_days IS NOT NULL AND prev_hist.estimated_days <> th.estimated_days
        ), task_work_mode_activities AS (
         SELECT t.epic_code,
            e.epic_title,
            e.epic_description,
            th.task_code AS entity_code,
            'TASK'::text AS entity_type,
            'Work mode changed to '::text || th.work_mode::text AS status_desc,
            th.assignee,
            th.created_at,
            th.created_by,
            'WORK_MODE_CHANGE'::text AS activity_type,
            (('Task #'::text || t.id::text) || ' work mode changed to '::text) || th.work_mode::text AS activity_description,
            t.task_title AS entity_title,
            t.description AS entity_description,
            t.id AS task_id,
            t.task_title,
            COALESCE(th.task_type_code, t.task_type_code) AS task_type_code
           FROM task_hist th
             JOIN tasks t ON th.task_code = t.id
             JOIN epics e ON t.epic_code = e.id
             LEFT JOIN LATERAL ( SELECT th_prev.work_mode
                   FROM task_hist th_prev
                  WHERE th_prev.task_code = th.task_code AND (th_prev.created_at < th.created_at OR th_prev.created_at = th.created_at AND th_prev.id < th.id)
                  ORDER BY th_prev.created_at DESC, th_prev.id DESC
                 LIMIT 1) prev_hist ON true
          WHERE th.work_mode IS NOT NULL AND prev_hist.work_mode IS NOT NULL AND prev_hist.work_mode::text <> th.work_mode::text
        ), task_type_code_activities AS (
         SELECT t.epic_code,
            e.epic_title,
            e.epic_description,
            th.task_code AS entity_code,
            'TASK'::text AS entity_type,
            'Task type changed to '::text || COALESCE(ttm.type_name, th.task_type_code, 'Unknown'::text::character varying)::text AS status_desc,
            th.assignee,
            th.created_at,
            th.created_by,
            'TYPE_CHANGE'::text AS activity_type,
            (('Task #'::text || t.id::text) || ' task type changed to '::text) || COALESCE(ttm.type_name, th.task_type_code, 'Unknown'::text::character varying)::text AS activity_description,
            t.task_title AS entity_title,
            t.description AS entity_description,
            t.id AS task_id,
            t.task_title,
            COALESCE(th.task_type_code, t.task_type_code) AS task_type_code
           FROM task_hist th
             JOIN tasks t ON th.task_code = t.id
             JOIN epics e ON t.epic_code = e.id
             LEFT JOIN task_type_master ttm ON th.task_type_code::text = ttm.type_code::text
             LEFT JOIN LATERAL ( SELECT th_prev.task_type_code
                   FROM task_hist th_prev
                  WHERE th_prev.task_code = th.task_code AND (th_prev.created_at < th.created_at OR th_prev.created_at = th.created_at AND th_prev.id < th.id)
                  ORDER BY th_prev.created_at DESC, th_prev.id DESC
                 LIMIT 1) prev_hist ON true
          WHERE th.task_type_code IS NOT NULL AND prev_hist.task_type_code IS NOT NULL AND prev_hist.task_type_code::text <> th.task_type_code::text
        ), task_reporter_activities AS (
         SELECT t.epic_code,
            e.epic_title,
            e.epic_description,
            th.task_code AS entity_code,
            'TASK'::text AS entity_type,
            'Reporter changed to '::text || COALESCE(um_reporter.user_name, th.reporter, 'Unknown'::text::character varying)::text AS status_desc,
            th.assignee,
            th.created_at,
            th.created_by,
            'REPORTER_CHANGE'::text AS activity_type,
            (('Task #'::text || t.id::text) || ' reporter changed to '::text) || COALESCE(um_reporter.user_name, th.reporter, 'Unknown'::text::character varying)::text AS activity_description,
            t.task_title AS entity_title,
            t.description AS entity_description,
            t.id AS task_id,
            t.task_title,
            COALESCE(th.task_type_code, t.task_type_code) AS task_type_code
           FROM task_hist th
             JOIN tasks t ON th.task_code = t.id
             JOIN epics e ON t.epic_code = e.id
             LEFT JOIN sts_new.user_master um_reporter ON th.reporter::text = um_reporter.user_code::text
             LEFT JOIN LATERAL ( SELECT th_prev.reporter
                   FROM task_hist th_prev
                  WHERE th_prev.task_code = th.task_code AND (th_prev.created_at < th.created_at OR th_prev.created_at = th.created_at AND th_prev.id < th.id)
                  ORDER BY th_prev.created_at DESC, th_prev.id DESC
                 LIMIT 1) prev_hist ON true
          WHERE th.reporter IS NOT NULL AND prev_hist.reporter IS NOT NULL AND prev_hist.reporter::text <> th.reporter::text
        ), epic_estimated_days_activities AS (
         SELECT eh.epic_code,
            e.epic_title,
            e.epic_description,
            eh.epic_code AS entity_code,
            'EPIC'::text AS entity_type,
            'Estimated days changed to '::text || eh.estimated_days::text AS status_desc,
            NULL::character varying AS assignee,
            eh.created_at,
            eh.created_by,
            'DAYS_CHANGE'::text AS activity_type,
            (('Epic #'::text || e.id::text) || ' estimated days changed to '::text) || eh.estimated_days::text AS activity_description,
            e.epic_title AS entity_title,
            e.epic_description AS entity_description,
            NULL::integer AS task_id,
            NULL::character varying AS task_title
           FROM epic_hist eh
             JOIN epics e ON eh.epic_code = e.id
             LEFT JOIN LATERAL ( SELECT eh_prev.estimated_days
                   FROM epic_hist eh_prev
                  WHERE eh_prev.epic_code = eh.epic_code AND (eh_prev.created_at < eh.created_at OR eh_prev.created_at = eh.created_at AND eh_prev.id < eh.id)
                  ORDER BY eh_prev.created_at DESC, eh_prev.id DESC
                 LIMIT 1) prev_hist ON true
          WHERE e.id IS NOT NULL AND eh.estimated_days IS NOT NULL AND prev_hist.estimated_days IS NOT NULL AND prev_hist.estimated_days <> eh.estimated_days
        ), epic_reporter_activities AS (
         SELECT eh.epic_code,
            e.epic_title,
            e.epic_description,
            eh.epic_code AS entity_code,
            'EPIC'::text AS entity_type,
            'Reporter changed to '::text || COALESCE(um_reporter.user_name, eh.reporter, 'Unknown'::text::character varying)::text AS status_desc,
            NULL::character varying AS assignee,
            eh.created_at,
            eh.created_by,
            'REPORTER_CHANGE'::text AS activity_type,
            (('Epic #'::text || e.id::text) || ' reporter changed to '::text) || COALESCE(um_reporter.user_name, eh.reporter, 'Unknown'::text::character varying)::text AS activity_description,
            e.epic_title AS entity_title,
            e.epic_description AS entity_description,
            NULL::integer AS task_id,
            NULL::character varying AS task_title
           FROM epic_hist eh
             JOIN epics e ON eh.epic_code = e.id
             LEFT JOIN sts_new.user_master um_reporter ON eh.reporter::text = um_reporter.user_code::text
             LEFT JOIN LATERAL ( SELECT eh_prev.reporter
                   FROM epic_hist eh_prev
                  WHERE eh_prev.epic_code = eh.epic_code AND (eh_prev.created_at < eh.created_at OR eh_prev.created_at = eh.created_at AND eh_prev.id < eh.id)
                  ORDER BY eh_prev.created_at DESC, eh_prev.id DESC
                 LIMIT 1) prev_hist ON true
          WHERE e.id IS NOT NULL AND eh.reporter IS NOT NULL AND prev_hist.reporter IS NOT NULL AND prev_hist.reporter::text <> eh.reporter::text
        ), task_team_activities AS (
         SELECT t.epic_code,
            e.epic_title,
            e.epic_description,
            th.task_code AS entity_code,
            'TASK'::text AS entity_type,
                CASE
                    WHEN prev_hist.assigned_team_code IS NULL THEN 'Assigned to team '::text || COALESCE(tm_team.team_name, th.assigned_team_code, 'Unknown'::text::character varying)::text
                    ELSE 'Team changed to '::text || COALESCE(tm_team.team_name, th.assigned_team_code, 'Unknown'::text::character varying)::text
                END AS status_desc,
            th.assignee,
            th.created_at,
            th.created_by,
            'TEAM_CHANGE'::text AS activity_type,
                CASE
                    WHEN prev_hist.assigned_team_code IS NULL THEN (('Task #'::text || t.id::text) || ' assigned to team '::text) || COALESCE(tm_team.team_name, th.assigned_team_code, 'Unknown'::text::character varying)::text
                    ELSE (('Task #'::text || t.id::text) || ' team changed to '::text) || COALESCE(tm_team.team_name, th.assigned_team_code, 'Unknown'::text::character varying)::text
                END AS activity_description,
            t.task_title AS entity_title,
            t.description AS entity_description,
            t.id AS task_id,
            t.task_title,
            COALESCE(th.task_type_code, t.task_type_code) AS task_type_code
           FROM task_hist th
             JOIN tasks t ON th.task_code = t.id
             JOIN epics e ON t.epic_code = e.id
             LEFT JOIN sts_new.team_master tm_team ON th.assigned_team_code::text = tm_team.team_code::text
             LEFT JOIN LATERAL ( SELECT th_prev.assigned_team_code
                   FROM task_hist th_prev
                  WHERE th_prev.task_code = th.task_code AND (th_prev.created_at < th.created_at OR th_prev.created_at = th.created_at AND th_prev.id < th.id)
                  ORDER BY th_prev.created_at DESC, th_prev.id DESC
                 LIMIT 1) prev_hist ON true
          WHERE th.assigned_team_code IS NOT NULL AND (prev_hist.assigned_team_code IS NULL OR prev_hist.assigned_team_code::text <> th.assigned_team_code::text)
        ), subtask_status_activities AS (
         SELECT t.epic_code,
            e.epic_title,
            e.epic_description,
            sh.subtask_code AS entity_code,
            'SUBTASK'::text AS entity_type,
                CASE
                    WHEN lower(TRIM(BOTH FROM sm.status_desc::text)) = 'not yet started'::text THEN 'To Do'::text::character varying
                    ELSE sm.status_desc
                END AS status_desc,
            sh.assignee,
            sh.created_at,
            sh.created_by,
                CASE
                    WHEN lower(TRIM(BOTH FROM sm.status_desc::text)) = 'not yet started'::text THEN 'TO_DO'::text
                    WHEN lower(TRIM(BOTH FROM sm.status_desc::text)) = 'in progress'::text THEN 'IN_PROGRESS'::text
                    WHEN lower(TRIM(BOTH FROM sm.status_desc::text)) = ANY (ARRAY['completed'::text, 'closed'::text]) THEN 'DONE'::text
                    WHEN lower(TRIM(BOTH FROM sm.status_desc::text)) = ANY (ARRAY['cancelled'::text, 'canceled'::text]) THEN 'BLOCKED'::text
                    ELSE 'STATUS_CHANGE'::text
                END AS activity_type,
                CASE
                    WHEN lower(TRIM(BOTH FROM sm.status_desc::text)) = 'not yet started'::text AND sh.assignee IS NOT NULL AND sh.assignee::text = sh.created_by::text THEN ('Subtask #'::text || st.id::text) || ' assigned to self'::text
                    WHEN lower(TRIM(BOTH FROM sm.status_desc::text)) = 'not yet started'::text AND sh.assignee IS NOT NULL THEN ('Subtask #'::text || st.id::text) || ' assigned'::text
                    WHEN lower(TRIM(BOTH FROM sm.status_desc::text)) = 'not yet started'::text THEN ('Subtask #'::text || st.id::text) || ' created'::text
                    WHEN lower(TRIM(BOTH FROM sm.status_desc::text)) = 'in progress'::text THEN ('Subtask #'::text || st.id::text) || ' started'::text
                    WHEN lower(TRIM(BOTH FROM sm.status_desc::text)) = ANY (ARRAY['completed'::text, 'closed'::text]) THEN ('Subtask #'::text || st.id::text) || ' completed'::text
                    WHEN lower(TRIM(BOTH FROM sm.status_desc::text)) = ANY (ARRAY['cancelled'::text, 'canceled'::text]) THEN ('Subtask #'::text || st.id::text) || ' blocked'::text
                    ELSE (('Subtask #'::text || st.id::text) || ' status changed to '::text) || sm.status_desc::text
                END AS activity_description,
            st.subtask_title AS entity_title,
            st.description AS entity_description,
            t.id AS task_id,
            t.task_title
           FROM subtask_hist sh
             JOIN sts_new.status_master sm ON sh.status_code::text = sm.status_code::text
             JOIN subtasks st ON sh.subtask_code = st.id
             JOIN tasks t ON st.task_id = t.id
             JOIN epics e ON t.epic_code = e.id
             LEFT JOIN LATERAL ( SELECT sh_prev.status_code
                   FROM subtask_hist sh_prev
                  WHERE sh_prev.subtask_code = sh.subtask_code AND (sh_prev.created_at < sh.created_at OR sh_prev.created_at = sh.created_at AND sh_prev.id < sh.id)
                  ORDER BY sh_prev.created_at DESC, sh_prev.id DESC
                 LIMIT 1) prev_hist ON true
          WHERE sh.status_code IS NOT NULL AND (prev_hist.status_code IS NULL OR prev_hist.status_code::text <> sh.status_code::text)
        ), subtask_priority_activities AS (
         SELECT t.epic_code,
            e.epic_title,
            e.epic_description,
            sh.subtask_code AS entity_code,
            'SUBTASK'::text AS entity_type,
            'Priority changed to '::text || COALESCE(pr.priority_desc, 'Unknown'::text::character varying)::text AS status_desc,
            sh.assignee,
            sh.created_at,
            sh.created_by,
            'PRIORITY_CHANGE'::text AS activity_type,
            (('Subtask #'::text || st.id::text) || ' priority changed to '::text) || COALESCE(pr.priority_desc, 'Unknown'::text::character varying)::text AS activity_description,
            st.subtask_title AS entity_title,
            st.description AS entity_description,
            t.id AS task_id,
            t.task_title
           FROM subtask_hist sh
             JOIN subtasks st ON sh.subtask_code = st.id
             JOIN tasks t ON st.task_id = t.id
             JOIN epics e ON t.epic_code = e.id
             LEFT JOIN sts_new.tkt_priority_master pr ON sh.priority_code = pr.priority_code
             LEFT JOIN LATERAL ( SELECT sh_prev.priority_code
                   FROM subtask_hist sh_prev
                  WHERE sh_prev.subtask_code = sh.subtask_code AND (sh_prev.created_at < sh.created_at OR sh_prev.created_at = sh.created_at AND sh_prev.id < sh.id)
                  ORDER BY sh_prev.created_at DESC, sh_prev.id DESC
                 LIMIT 1) prev_hist ON true
          WHERE sh.priority_code IS NOT NULL AND prev_hist.priority_code IS NOT NULL AND prev_hist.priority_code <> sh.priority_code
        ), subtask_assignee_activities AS (
         SELECT t.epic_code,
            e.epic_title,
            e.epic_description,
            sh.subtask_code AS entity_code,
            'SUBTASK'::text AS entity_type,
                CASE
                    WHEN sh.assignee::text = sh.created_by::text THEN 'Assigned to self'::text
                    WHEN prev_hist.assignee IS NULL THEN 'Assigned to '::text || COALESCE(um_assignee_sub.user_name, sh.assignee, 'Unknown'::text::character varying)::text
                    ELSE 'Assignee changed to '::text || COALESCE(um_assignee_sub.user_name, sh.assignee, 'Unknown'::text::character varying)::text
                END AS status_desc,
            sh.assignee,
            sh.created_at,
            sh.created_by,
            'ASSIGNEE_CHANGE'::text AS activity_type,
                CASE
                    WHEN sh.assignee::text = sh.created_by::text THEN ('Subtask #'::text || st.id::text) || ' assigned to self'::text
                    WHEN prev_hist.assignee IS NULL THEN (('Subtask #'::text || st.id::text) || ' assigned to '::text) || COALESCE(um_assignee_sub.user_name, sh.assignee, 'Unknown'::text::character varying)::text
                    ELSE (('Subtask #'::text || st.id::text) || ' assignee changed to '::text) || COALESCE(um_assignee_sub.user_name, sh.assignee, 'Unknown'::text::character varying)::text
                END AS activity_description,
            st.subtask_title AS entity_title,
            st.description AS entity_description,
            t.id AS task_id,
            t.task_title
           FROM subtask_hist sh
             JOIN subtasks st ON sh.subtask_code = st.id
             JOIN tasks t ON st.task_id = t.id
             JOIN epics e ON t.epic_code = e.id
             LEFT JOIN sts_new.user_master um_assignee_sub ON sh.assignee::text = um_assignee_sub.user_code::text
             LEFT JOIN LATERAL ( SELECT sh_prev.assignee
                   FROM subtask_hist sh_prev
                  WHERE sh_prev.subtask_code = sh.subtask_code AND (sh_prev.created_at < sh.created_at OR sh_prev.created_at = sh.created_at AND sh_prev.id < sh.id)
                  ORDER BY sh_prev.created_at DESC, sh_prev.id DESC
                 LIMIT 1) prev_hist ON true
          WHERE sh.assignee IS NOT NULL AND (prev_hist.assignee IS NULL OR prev_hist.assignee::text <> sh.assignee::text)
        ), subtask_estimated_hours_activities AS (
         SELECT t.epic_code,
            e.epic_title,
            e.epic_description,
            sh.subtask_code AS entity_code,
            'SUBTASK'::text AS entity_type,
            'Estimated hours changed to '::text || sh.estimated_hours::text AS status_desc,
            sh.assignee,
            sh.created_at,
            sh.created_by,
            'HOURS_CHANGE'::text AS activity_type,
            (('Subtask #'::text || st.id::text) || ' estimated hours changed to '::text) || sh.estimated_hours::text AS activity_description,
            st.subtask_title AS entity_title,
            st.description AS entity_description,
            t.id AS task_id,
            t.task_title
           FROM subtask_hist sh
             JOIN subtasks st ON sh.subtask_code = st.id
             JOIN tasks t ON st.task_id = t.id
             JOIN epics e ON t.epic_code = e.id
             LEFT JOIN LATERAL ( SELECT sh_prev.estimated_hours
                   FROM subtask_hist sh_prev
                  WHERE sh_prev.subtask_code = sh.subtask_code AND (sh_prev.created_at < sh.created_at OR sh_prev.created_at = sh.created_at AND sh_prev.id < sh.id)
                  ORDER BY sh_prev.created_at DESC, sh_prev.id DESC
                 LIMIT 1) prev_hist ON true
          WHERE sh.estimated_hours IS NOT NULL AND prev_hist.estimated_hours IS NOT NULL AND prev_hist.estimated_hours <> sh.estimated_hours
        ), subtask_estimated_days_activities AS (
         SELECT t.epic_code,
            e.epic_title,
            e.epic_description,
            sh.subtask_code AS entity_code,
            'SUBTASK'::text AS entity_type,
            'Estimated days changed to '::text || sh.estimated_days::text AS status_desc,
            sh.assignee,
            sh.created_at,
            sh.created_by,
            'DAYS_CHANGE'::text AS activity_type,
            (('Subtask #'::text || st.id::text) || ' estimated days changed to '::text) || sh.estimated_days::text AS activity_description,
            st.subtask_title AS entity_title,
            st.description AS entity_description,
            t.id AS task_id,
            t.task_title
           FROM subtask_hist sh
             JOIN subtasks st ON sh.subtask_code = st.id
             JOIN tasks t ON st.task_id = t.id
             JOIN epics e ON t.epic_code = e.id
             LEFT JOIN LATERAL ( SELECT sh_prev.estimated_days
                   FROM subtask_hist sh_prev
                  WHERE sh_prev.subtask_code = sh.subtask_code AND (sh_prev.created_at < sh.created_at OR sh_prev.created_at = sh.created_at AND sh_prev.id < sh.id)
                  ORDER BY sh_prev.created_at DESC, sh_prev.id DESC
                 LIMIT 1) prev_hist ON true
          WHERE sh.estimated_days IS NOT NULL AND prev_hist.estimated_days IS NOT NULL AND prev_hist.estimated_days <> sh.estimated_days
        )
 SELECT all_activities.epic_code,
    all_activities.epic_title,
    all_activities.epic_description,
    all_activities.activity_type,
    all_activities.entity_code,
    all_activities.entity_type,
    all_activities.status_desc,
    all_activities.assignee,
    all_activities.created_at,
    all_activities.created_by,
    all_activities.activity_description,
    all_activities.entity_title,
    all_activities.entity_description,
    all_activities.task_id,
    all_activities.task_title,
    COALESCE(um_created.user_name, 'System'::text::character varying) AS created_by_name,
    COALESCE(um_assignee.user_name, 'Unassigned'::text::character varying) AS assignee_name,
    to_char(all_activities.created_at, 'DD/MM/YYYY HH24:MI'::text) AS formatted_time,
    to_char(all_activities.created_at, 'DD/MM/YYYY HH12:MI AM'::text) AS time_ago
   FROM ( SELECT epic_status_activities.epic_code,
            epic_status_activities.epic_title,
            epic_status_activities.epic_description,
            epic_status_activities.entity_code,
            epic_status_activities.entity_type,
            epic_status_activities.status_desc,
            epic_status_activities.assignee,
            epic_status_activities.created_at,
            epic_status_activities.created_by,
            epic_status_activities.activity_type,
            epic_status_activities.activity_description,
            epic_status_activities.entity_title,
            epic_status_activities.entity_description,
            epic_status_activities.task_id,
            epic_status_activities.task_title
           FROM epic_status_activities
        UNION ALL
         SELECT task_status_activities.epic_code,
            task_status_activities.epic_title,
            task_status_activities.epic_description,
            task_status_activities.entity_code,
            task_status_activities.entity_type,
            task_status_activities.status_desc,
            task_status_activities.assignee,
            task_status_activities.created_at,
            task_status_activities.created_by,
            task_status_activities.activity_type,
            task_status_activities.activity_description,
            task_status_activities.entity_title,
            task_status_activities.entity_description,
            task_status_activities.task_id,
            task_status_activities.task_title
           FROM task_status_activities
        UNION ALL
         SELECT epic_creation_activities.epic_code,
            epic_creation_activities.epic_title,
            epic_creation_activities.epic_description,
            epic_creation_activities.entity_code,
            epic_creation_activities.entity_type,
            epic_creation_activities.status_desc,
            epic_creation_activities.assignee,
            epic_creation_activities.created_at,
            epic_creation_activities.created_by,
            epic_creation_activities.activity_type,
            epic_creation_activities.activity_description,
            epic_creation_activities.entity_title,
            epic_creation_activities.entity_description,
            epic_creation_activities.task_id,
            epic_creation_activities.task_title
           FROM epic_creation_activities
        UNION ALL
         SELECT task_creation_activities.epic_code,
            task_creation_activities.epic_title,
            task_creation_activities.epic_description,
            task_creation_activities.entity_code,
            task_creation_activities.entity_type,
            task_creation_activities.status_desc,
            task_creation_activities.assignee,
            task_creation_activities.created_at,
            task_creation_activities.created_by,
            task_creation_activities.activity_type,
            task_creation_activities.activity_description,
            task_creation_activities.entity_title,
            task_creation_activities.entity_description,
            task_creation_activities.task_id,
            task_creation_activities.task_title
           FROM task_creation_activities
        UNION ALL
         SELECT comment_activities.epic_code,
            comment_activities.epic_title,
            comment_activities.epic_description,
            comment_activities.entity_code,
            comment_activities.entity_type,
            comment_activities.status_desc,
            comment_activities.assignee,
            comment_activities.created_at,
            comment_activities.created_by,
            comment_activities.activity_type,
            comment_activities.activity_description,
            comment_activities.entity_title,
            comment_activities.entity_description,
            comment_activities.task_id,
            comment_activities.task_title
           FROM comment_activities
        UNION ALL
         SELECT task_cancellation_activities.epic_code,
            task_cancellation_activities.epic_title,
            task_cancellation_activities.epic_description,
            task_cancellation_activities.entity_code,
            task_cancellation_activities.entity_type,
            task_cancellation_activities.status_desc,
            task_cancellation_activities.assignee,
            task_cancellation_activities.created_at,
            task_cancellation_activities.created_by,
            task_cancellation_activities.activity_type,
            task_cancellation_activities.activity_description,
            task_cancellation_activities.entity_title,
            task_cancellation_activities.entity_description,
            task_cancellation_activities.task_id,
            task_cancellation_activities.task_title
           FROM task_cancellation_activities
        UNION ALL
         SELECT epic_cancellation_activities.epic_code,
            epic_cancellation_activities.epic_title,
            epic_cancellation_activities.epic_description,
            epic_cancellation_activities.entity_code,
            epic_cancellation_activities.entity_type,
            epic_cancellation_activities.status_desc,
            epic_cancellation_activities.assignee,
            epic_cancellation_activities.created_at,
            epic_cancellation_activities.created_by,
            epic_cancellation_activities.activity_type,
            epic_cancellation_activities.activity_description,
            epic_cancellation_activities.entity_title,
            epic_cancellation_activities.entity_description,
            epic_cancellation_activities.task_id,
            epic_cancellation_activities.task_title
           FROM epic_cancellation_activities
        UNION ALL
         SELECT epic_priority_activities.epic_code,
            epic_priority_activities.epic_title,
            epic_priority_activities.epic_description,
            epic_priority_activities.entity_code,
            epic_priority_activities.entity_type,
            epic_priority_activities.status_desc,
            epic_priority_activities.assignee,
            epic_priority_activities.created_at,
            epic_priority_activities.created_by,
            epic_priority_activities.activity_type,
            epic_priority_activities.activity_description,
            epic_priority_activities.entity_title,
            epic_priority_activities.entity_description,
            epic_priority_activities.task_id,
            epic_priority_activities.task_title
           FROM epic_priority_activities
        UNION ALL
         SELECT task_priority_activities.epic_code,
            task_priority_activities.epic_title,
            task_priority_activities.epic_description,
            task_priority_activities.entity_code,
            task_priority_activities.entity_type,
            task_priority_activities.status_desc,
            task_priority_activities.assignee,
            task_priority_activities.created_at,
            task_priority_activities.created_by,
            task_priority_activities.activity_type,
            task_priority_activities.activity_description,
            task_priority_activities.entity_title,
            task_priority_activities.entity_description,
            task_priority_activities.task_id,
            task_priority_activities.task_title
           FROM task_priority_activities
        UNION ALL
         SELECT epic_start_date_activities.epic_code,
            epic_start_date_activities.epic_title,
            epic_start_date_activities.epic_description,
            epic_start_date_activities.entity_code,
            epic_start_date_activities.entity_type,
            epic_start_date_activities.status_desc,
            epic_start_date_activities.assignee,
            epic_start_date_activities.created_at,
            epic_start_date_activities.created_by,
            epic_start_date_activities.activity_type,
            epic_start_date_activities.activity_description,
            epic_start_date_activities.entity_title,
            epic_start_date_activities.entity_description,
            epic_start_date_activities.task_id,
            epic_start_date_activities.task_title
           FROM epic_start_date_activities
        UNION ALL
         SELECT epic_due_date_activities.epic_code,
            epic_due_date_activities.epic_title,
            epic_due_date_activities.epic_description,
            epic_due_date_activities.entity_code,
            epic_due_date_activities.entity_type,
            epic_due_date_activities.status_desc,
            epic_due_date_activities.assignee,
            epic_due_date_activities.created_at,
            epic_due_date_activities.created_by,
            epic_due_date_activities.activity_type,
            epic_due_date_activities.activity_description,
            epic_due_date_activities.entity_title,
            epic_due_date_activities.entity_description,
            epic_due_date_activities.task_id,
            epic_due_date_activities.task_title
           FROM epic_due_date_activities
        UNION ALL
         SELECT epic_estimated_hours_activities.epic_code,
            epic_estimated_hours_activities.epic_title,
            epic_estimated_hours_activities.epic_description,
            epic_estimated_hours_activities.entity_code,
            epic_estimated_hours_activities.entity_type,
            epic_estimated_hours_activities.status_desc,
            epic_estimated_hours_activities.assignee,
            epic_estimated_hours_activities.created_at,
            epic_estimated_hours_activities.created_by,
            epic_estimated_hours_activities.activity_type,
            epic_estimated_hours_activities.activity_description,
            epic_estimated_hours_activities.entity_title,
            epic_estimated_hours_activities.entity_description,
            epic_estimated_hours_activities.task_id,
            epic_estimated_hours_activities.task_title
           FROM epic_estimated_hours_activities
        UNION ALL
         SELECT epic_product_activities.epic_code,
            epic_product_activities.epic_title,
            epic_product_activities.epic_description,
            epic_product_activities.entity_code,
            epic_product_activities.entity_type,
            epic_product_activities.status_desc,
            epic_product_activities.assignee,
            epic_product_activities.created_at,
            epic_product_activities.created_by,
            epic_product_activities.activity_type,
            epic_product_activities.activity_description,
            epic_product_activities.entity_title,
            epic_product_activities.entity_description,
            epic_product_activities.task_id,
            epic_product_activities.task_title
           FROM epic_product_activities
        UNION ALL
         SELECT task_assignee_activities.epic_code,
            task_assignee_activities.epic_title,
            task_assignee_activities.epic_description,
            task_assignee_activities.entity_code,
            task_assignee_activities.entity_type,
            task_assignee_activities.status_desc,
            task_assignee_activities.assignee,
            task_assignee_activities.created_at,
            task_assignee_activities.created_by,
            task_assignee_activities.activity_type,
            task_assignee_activities.activity_description,
            task_assignee_activities.entity_title,
            task_assignee_activities.entity_description,
            task_assignee_activities.task_id,
            task_assignee_activities.task_title
           FROM task_assignee_activities
        UNION ALL
         SELECT epic_assignee_activities.epic_code,
            epic_assignee_activities.epic_title,
            epic_assignee_activities.epic_description,
            epic_assignee_activities.entity_code,
            epic_assignee_activities.entity_type,
            epic_assignee_activities.status_desc,
            epic_assignee_activities.assignee,
            epic_assignee_activities.created_at,
            epic_assignee_activities.created_by,
            epic_assignee_activities.activity_type,
            epic_assignee_activities.activity_description,
            epic_assignee_activities.entity_title,
            epic_assignee_activities.entity_description,
            epic_assignee_activities.task_id,
            epic_assignee_activities.task_title
           FROM epic_assignee_activities
        UNION ALL
         SELECT task_start_date_activities.epic_code,
            task_start_date_activities.epic_title,
            task_start_date_activities.epic_description,
            task_start_date_activities.entity_code,
            task_start_date_activities.entity_type,
            task_start_date_activities.status_desc,
            task_start_date_activities.assignee,
            task_start_date_activities.created_at,
            task_start_date_activities.created_by,
            task_start_date_activities.activity_type,
            task_start_date_activities.activity_description,
            task_start_date_activities.entity_title,
            task_start_date_activities.entity_description,
            task_start_date_activities.task_id,
            task_start_date_activities.task_title
           FROM task_start_date_activities
        UNION ALL
         SELECT task_due_date_activities.epic_code,
            task_due_date_activities.epic_title,
            task_due_date_activities.epic_description,
            task_due_date_activities.entity_code,
            task_due_date_activities.entity_type,
            task_due_date_activities.status_desc,
            task_due_date_activities.assignee,
            task_due_date_activities.created_at,
            task_due_date_activities.created_by,
            task_due_date_activities.activity_type,
            task_due_date_activities.activity_description,
            task_due_date_activities.entity_title,
            task_due_date_activities.entity_description,
            task_due_date_activities.task_id,
            task_due_date_activities.task_title
           FROM task_due_date_activities
        UNION ALL
         SELECT task_estimated_hours_activities.epic_code,
            task_estimated_hours_activities.epic_title,
            task_estimated_hours_activities.epic_description,
            task_estimated_hours_activities.entity_code,
            task_estimated_hours_activities.entity_type,
            task_estimated_hours_activities.status_desc,
            task_estimated_hours_activities.assignee,
            task_estimated_hours_activities.created_at,
            task_estimated_hours_activities.created_by,
            task_estimated_hours_activities.activity_type,
            task_estimated_hours_activities.activity_description,
            task_estimated_hours_activities.entity_title,
            task_estimated_hours_activities.entity_description,
            task_estimated_hours_activities.task_id,
            task_estimated_hours_activities.task_title
           FROM task_estimated_hours_activities
        UNION ALL
         SELECT task_estimated_days_activities.epic_code,
            task_estimated_days_activities.epic_title,
            task_estimated_days_activities.epic_description,
            task_estimated_days_activities.entity_code,
            task_estimated_days_activities.entity_type,
            task_estimated_days_activities.status_desc,
            task_estimated_days_activities.assignee,
            task_estimated_days_activities.created_at,
            task_estimated_days_activities.created_by,
            task_estimated_days_activities.activity_type,
            task_estimated_days_activities.activity_description,
            task_estimated_days_activities.entity_title,
            task_estimated_days_activities.entity_description,
            task_estimated_days_activities.task_id,
            task_estimated_days_activities.task_title
           FROM task_estimated_days_activities
        UNION ALL
         SELECT task_work_mode_activities.epic_code,
            task_work_mode_activities.epic_title,
            task_work_mode_activities.epic_description,
            task_work_mode_activities.entity_code,
            task_work_mode_activities.entity_type,
            task_work_mode_activities.status_desc,
            task_work_mode_activities.assignee,
            task_work_mode_activities.created_at,
            task_work_mode_activities.created_by,
            task_work_mode_activities.activity_type,
            task_work_mode_activities.activity_description,
            task_work_mode_activities.entity_title,
            task_work_mode_activities.entity_description,
            task_work_mode_activities.task_id,
            task_work_mode_activities.task_title
           FROM task_work_mode_activities
        UNION ALL
         SELECT task_type_code_activities.epic_code,
            task_type_code_activities.epic_title,
            task_type_code_activities.epic_description,
            task_type_code_activities.entity_code,
            task_type_code_activities.entity_type,
            task_type_code_activities.status_desc,
            task_type_code_activities.assignee,
            task_type_code_activities.created_at,
            task_type_code_activities.created_by,
            task_type_code_activities.activity_type,
            task_type_code_activities.activity_description,
            task_type_code_activities.entity_title,
            task_type_code_activities.entity_description,
            task_type_code_activities.task_id,
            task_type_code_activities.task_title
           FROM task_type_code_activities
        UNION ALL
         SELECT task_reporter_activities.epic_code,
            task_reporter_activities.epic_title,
            task_reporter_activities.epic_description,
            task_reporter_activities.entity_code,
            task_reporter_activities.entity_type,
            task_reporter_activities.status_desc,
            task_reporter_activities.assignee,
            task_reporter_activities.created_at,
            task_reporter_activities.created_by,
            task_reporter_activities.activity_type,
            task_reporter_activities.activity_description,
            task_reporter_activities.entity_title,
            task_reporter_activities.entity_description,
            task_reporter_activities.task_id,
            task_reporter_activities.task_title
           FROM task_reporter_activities
        UNION ALL
         SELECT epic_estimated_days_activities.epic_code,
            epic_estimated_days_activities.epic_title,
            epic_estimated_days_activities.epic_description,
            epic_estimated_days_activities.entity_code,
            epic_estimated_days_activities.entity_type,
            epic_estimated_days_activities.status_desc,
            epic_estimated_days_activities.assignee,
            epic_estimated_days_activities.created_at,
            epic_estimated_days_activities.created_by,
            epic_estimated_days_activities.activity_type,
            epic_estimated_days_activities.activity_description,
            epic_estimated_days_activities.entity_title,
            epic_estimated_days_activities.entity_description,
            epic_estimated_days_activities.task_id,
            epic_estimated_days_activities.task_title
           FROM epic_estimated_days_activities
        UNION ALL
         SELECT epic_reporter_activities.epic_code,
            epic_reporter_activities.epic_title,
            epic_reporter_activities.epic_description,
            epic_reporter_activities.entity_code,
            epic_reporter_activities.entity_type,
            epic_reporter_activities.status_desc,
            epic_reporter_activities.assignee,
            epic_reporter_activities.created_at,
            epic_reporter_activities.created_by,
            epic_reporter_activities.activity_type,
            epic_reporter_activities.activity_description,
            epic_reporter_activities.entity_title,
            epic_reporter_activities.entity_description,
            epic_reporter_activities.task_id,
            epic_reporter_activities.task_title
           FROM epic_reporter_activities
        UNION ALL
         SELECT task_team_activities.epic_code,
            task_team_activities.epic_title,
            task_team_activities.epic_description,
            task_team_activities.entity_code,
            task_team_activities.entity_type,
            task_team_activities.status_desc,
            task_team_activities.assignee,
            task_team_activities.created_at,
            task_team_activities.created_by,
            task_team_activities.activity_type,
            task_team_activities.activity_description,
            task_team_activities.entity_title,
            task_team_activities.entity_description,
            task_team_activities.task_id,
            task_team_activities.task_title
           FROM task_team_activities
        UNION ALL
         SELECT subtask_status_activities.epic_code,
            subtask_status_activities.epic_title,
            subtask_status_activities.epic_description,
            subtask_status_activities.entity_code,
            subtask_status_activities.entity_type,
            subtask_status_activities.status_desc,
            subtask_status_activities.assignee,
            subtask_status_activities.created_at,
            subtask_status_activities.created_by,
            subtask_status_activities.activity_type,
            subtask_status_activities.activity_description,
            subtask_status_activities.entity_title,
            subtask_status_activities.entity_description,
            subtask_status_activities.task_id,
            subtask_status_activities.task_title
           FROM subtask_status_activities
        UNION ALL
         SELECT subtask_priority_activities.epic_code,
            subtask_priority_activities.epic_title,
            subtask_priority_activities.epic_description,
            subtask_priority_activities.entity_code,
            subtask_priority_activities.entity_type,
            subtask_priority_activities.status_desc,
            subtask_priority_activities.assignee,
            subtask_priority_activities.created_at,
            subtask_priority_activities.created_by,
            subtask_priority_activities.activity_type,
            subtask_priority_activities.activity_description,
            subtask_priority_activities.entity_title,
            subtask_priority_activities.entity_description,
            subtask_priority_activities.task_id,
            subtask_priority_activities.task_title
           FROM subtask_priority_activities
        UNION ALL
         SELECT subtask_assignee_activities.epic_code,
            subtask_assignee_activities.epic_title,
            subtask_assignee_activities.epic_description,
            subtask_assignee_activities.entity_code,
            subtask_assignee_activities.entity_type,
            subtask_assignee_activities.status_desc,
            subtask_assignee_activities.assignee,
            subtask_assignee_activities.created_at,
            subtask_assignee_activities.created_by,
            subtask_assignee_activities.activity_type,
            subtask_assignee_activities.activity_description,
            subtask_assignee_activities.entity_title,
            subtask_assignee_activities.entity_description,
            subtask_assignee_activities.task_id,
            subtask_assignee_activities.task_title
           FROM subtask_assignee_activities
        UNION ALL
         SELECT subtask_estimated_hours_activities.epic_code,
            subtask_estimated_hours_activities.epic_title,
            subtask_estimated_hours_activities.epic_description,
            subtask_estimated_hours_activities.entity_code,
            subtask_estimated_hours_activities.entity_type,
            subtask_estimated_hours_activities.status_desc,
            subtask_estimated_hours_activities.assignee,
            subtask_estimated_hours_activities.created_at,
            subtask_estimated_hours_activities.created_by,
            subtask_estimated_hours_activities.activity_type,
            subtask_estimated_hours_activities.activity_description,
            subtask_estimated_hours_activities.entity_title,
            subtask_estimated_hours_activities.entity_description,
            subtask_estimated_hours_activities.task_id,
            subtask_estimated_hours_activities.task_title
           FROM subtask_estimated_hours_activities
        UNION ALL
         SELECT subtask_estimated_days_activities.epic_code,
            subtask_estimated_days_activities.epic_title,
            subtask_estimated_days_activities.epic_description,
            subtask_estimated_days_activities.entity_code,
            subtask_estimated_days_activities.entity_type,
            subtask_estimated_days_activities.status_desc,
            subtask_estimated_days_activities.assignee,
            subtask_estimated_days_activities.created_at,
            subtask_estimated_days_activities.created_by,
            subtask_estimated_days_activities.activity_type,
            subtask_estimated_days_activities.activity_description,
            subtask_estimated_days_activities.entity_title,
            subtask_estimated_days_activities.entity_description,
            subtask_estimated_days_activities.task_id,
            subtask_estimated_days_activities.task_title
           FROM subtask_estimated_days_activities) all_activities
     LEFT JOIN sts_new.user_master um_created ON all_activities.created_by::text = um_created.user_code::text
     LEFT JOIN sts_new.user_master um_assignee ON all_activities.assignee::text = um_assignee.user_code::text
  ORDER BY all_activities.created_at DESC, all_activities.epic_code;

ALTER TABLE sts_ts.view_recent_activities
    OWNER TO sts_ts;

