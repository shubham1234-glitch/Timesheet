-- View: sts_ts.view_comments

-- DROP VIEW sts_ts.view_comments;

CREATE OR REPLACE VIEW sts_ts.view_comments
 AS
 SELECT c.id AS comment_id,
    c.parent_type,
    c.parent_code,
    c.comment_text,
    c.commented_by,
    um.user_name AS commented_by_name,
    c.commented_at,
    c.updated_by,
    c.updated_at
   FROM comments c
     LEFT JOIN sts_new.user_master um ON um.user_code::text = c.commented_by::text;

ALTER TABLE sts_ts.view_comments
    OWNER TO sts_ts;
COMMENT ON VIEW sts_ts.view_comments
    IS 'Flattened comments with commenter display name for tasks, epics, and timesheet entries';

GRANT ALL ON TABLE sts_ts.view_comments TO sts_ts;
GRANT SELECT ON TABLE sts_ts.view_comments TO sukraa_analyst;
GRANT INSERT, SELECT, UPDATE, DELETE ON TABLE sts_ts.view_comments TO sukraa_dev;

