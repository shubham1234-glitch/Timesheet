-- View: sts_ts.view_tickets_for_timesheet

-- DROP VIEW sts_ts.view_tickets_for_timesheet;

CREATE OR REPLACE VIEW sts_ts.view_tickets_for_timesheet
 AS
 SELECT tkt.ticket_code,
    tkt.title AS ticket_title,
    tkt.description AS ticket_description,
    COALESCE(sh.status_desc, 'Unassigned'::character varying) AS ticket_status,
    sh.status_code AS ticket_status_code,
    pr_hist.priority_desc AS ticket_priority,
    pr_hist.priority_code AS ticket_priority_code,
    sh.assignee AS ticket_assignee,
    sh.assignee AS user_code,
    um_assignee.user_name AS ticket_assignee_name,
    tkt.company_code,
    cm.company_name,
    tkt.product_code,
    pm.product_name,
    tkt.contact_person_code,
    cpm.full_name AS contact_person_name,
    tkt.category_code,
    cat.category_name AS ticket_type,
    tkt.created_at AS ticket_created_at,
    sh.assigned_on AS ticket_assigned_on,
    tkt.start_date,
    tkt.due_date,
    tkt.resolved_on,
    tkt.closed_on,
    tkt.is_billable
   FROM sts_new.ticket_master tkt
     LEFT JOIN LATERAL ( SELECT DISTINCT ON (sh_inner.ticket_code) sh_inner.ticket_code,
            sh_inner.status_desc,
            sh_inner.status_code,
            sh_inner.assignee,
            sh_inner.assigned_on,
            sh_inner.created_at
           FROM sts_new.status_hist sh_inner
          WHERE sh_inner.ticket_code = tkt.ticket_code
          ORDER BY sh_inner.ticket_code, sh_inner.created_at DESC
         LIMIT 1) sh ON true
     LEFT JOIN LATERAL ( SELECT DISTINCT ON (pr_inner.ticket_code) pr_inner.ticket_code,
            pr_inner.priority_desc,
            pr_inner.priority_code,
            pr_inner.created_at
           FROM sts_new.tkt_priority_hist pr_inner
          WHERE pr_inner.ticket_code = tkt.ticket_code
          ORDER BY pr_inner.ticket_code, pr_inner.created_at DESC
         LIMIT 1) pr_hist ON true
     LEFT JOIN sts_new.user_master um_assignee ON sh.assignee::text = um_assignee.user_code::text AND um_assignee.is_inactive = false
     LEFT JOIN sts_new.company_master cm ON tkt.company_code::text = cm.company_code::text AND cm.is_inactive = false
     LEFT JOIN sts_new.product_master pm ON tkt.product_code::text = pm.product_code::text AND pm.is_inactive = false
     LEFT JOIN sts_new.contact_master cpm ON tkt.contact_person_code::text = cpm.contact_person_code::text AND cpm.is_inactive = false
     LEFT JOIN sts_new.category_master cat ON tkt.category_code::text = cat.category_code::text AND cat.is_inactive = false
  WHERE (tkt.is_cancelled IS NULL OR tkt.is_cancelled = false) AND (tkt.is_rejected IS NULL OR tkt.is_rejected = false) AND (sh.status_desc IS NULL OR (lower(TRIM(BOTH FROM sh.status_desc)) <> ALL (ARRAY['cancelled'::text, 'rejected'::text])))
  ORDER BY tkt.created_at DESC;

ALTER TABLE sts_ts.view_tickets_for_timesheet
    OWNER TO sts_ts;

GRANT ALL ON TABLE sts_ts.view_tickets_for_timesheet TO sts_ts;
GRANT SELECT ON TABLE sts_ts.view_tickets_for_timesheet TO sukraa_analyst;
GRANT SELECT ON TABLE sts_ts.view_tickets_for_timesheet TO sukraa_dev;

