-- View: sts_ts.view_challenges

-- DROP VIEW sts_ts.view_challenges;

CREATE OR REPLACE VIEW sts_ts.view_challenges
 AS
 SELECT c.id AS challenge_id,
    c.parent_type,
    c.parent_code,
    c.challenge_title,
    c.challenge_description,
    c.created_by,
    um_created.user_name AS created_by_name,
    c.created_at,
    c.updated_by,
    um_updated.user_name AS updated_by_name,
    c.updated_at
   FROM challenges c
     LEFT JOIN sts_new.user_master um_created ON um_created.user_code::text = c.created_by::text
     LEFT JOIN sts_new.user_master um_updated ON um_updated.user_code::text = c.updated_by::text;

ALTER TABLE sts_ts.view_challenges
    OWNER TO sts_ts;
COMMENT ON VIEW sts_ts.view_challenges
    IS 'Flattened challenges with creator and updater display names for tasks, subtasks, epics, and timesheet entries';

GRANT ALL ON TABLE sts_ts.view_challenges TO sts_ts;
GRANT SELECT ON TABLE sts_ts.view_challenges TO sukraa_analyst;
GRANT INSERT, SELECT, UPDATE, DELETE ON TABLE sts_ts.view_challenges TO sukraa_dev;

