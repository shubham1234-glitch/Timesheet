-- Table: sts_ts.subtasks

-- DROP TABLE IF EXISTS sts_ts.subtasks;

CREATE TABLE IF NOT EXISTS sts_ts.subtasks
(
    id integer NOT NULL DEFAULT nextval('subtasks_id_seq'::regclass),
    subtask_title character varying(255) COLLATE pg_catalog."default" NOT NULL,
    description text COLLATE pg_catalog."default",
    task_id integer NOT NULL,
    assignee character varying(50) COLLATE pg_catalog."default",
    assigned_team_code character varying(10) COLLATE pg_catalog."default",
    status_code character varying(30) COLLATE pg_catalog."default" NOT NULL,
    priority_code integer,
    work_mode character varying(30) COLLATE pg_catalog."default",
    start_date date,
    due_date date,
    closed_on date,
    estimated_hours numeric(6,2),
    estimated_days numeric(6,2),
    is_billable boolean DEFAULT true,
    cancelled_by character varying(50) COLLATE pg_catalog."default",
    cancelled_at date,
    cancellation_reason text COLLATE pg_catalog."default",
    created_by character varying(30) COLLATE pg_catalog."default" NOT NULL DEFAULT CURRENT_USER,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_by character varying(30) COLLATE pg_catalog."default",
    updated_at timestamp without time zone,
    CONSTRAINT subtasks_pkey PRIMARY KEY (id),
    CONSTRAINT fk_subtask_assigned_team FOREIGN KEY (assigned_team_code)
        REFERENCES sts_new.team_master (team_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_subtask_assignee FOREIGN KEY (assignee)
        REFERENCES sts_new.user_master (user_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_subtask_cancelled_by FOREIGN KEY (cancelled_by)
        REFERENCES sts_new.user_master (user_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_subtask_created_by FOREIGN KEY (created_by)
        REFERENCES sts_new.user_master (user_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_subtask_priority FOREIGN KEY (priority_code)
        REFERENCES sts_new.tkt_priority_master (priority_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_subtask_status FOREIGN KEY (status_code)
        REFERENCES sts_new.status_master (status_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_subtask_task FOREIGN KEY (task_id)
        REFERENCES sts_ts.tasks (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE,
    CONSTRAINT fk_subtask_updated_by FOREIGN KEY (updated_by)
        REFERENCES sts_new.user_master (user_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT chk_subtasks_status_code CHECK (status_code::text = ANY (ARRAY['STS001'::character varying, 'STS007'::character varying, 'STS002'::character varying, 'STS010'::character varying]::text[])),
    CONSTRAINT chk_subtasks_work_mode CHECK (work_mode IS NULL OR (work_mode::text = ANY (ARRAY['REMOTE'::character varying, 'ON_SITE'::character varying, 'OFFICE'::character varying]::text[])))
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS sts_ts.subtasks
    OWNER to sts_ts;

REVOKE ALL ON TABLE sts_ts.subtasks FROM sukraa_analyst;
REVOKE ALL ON TABLE sts_ts.subtasks FROM sukraa_dev;

GRANT ALL ON TABLE sts_ts.subtasks TO sts_ts;

GRANT SELECT ON TABLE sts_ts.subtasks TO sukraa_analyst;

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE sts_ts.subtasks TO sukraa_dev;
-- Index: idx_subtasks_assigned_team_code

-- DROP INDEX IF EXISTS sts_ts.idx_subtasks_assigned_team_code;

CREATE INDEX IF NOT EXISTS idx_subtasks_assigned_team_code
    ON sts_ts.subtasks USING btree
    (assigned_team_code COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_subtasks_assignee

-- DROP INDEX IF EXISTS sts_ts.idx_subtasks_assignee;

CREATE INDEX IF NOT EXISTS idx_subtasks_assignee
    ON sts_ts.subtasks USING btree
    (assignee COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_subtasks_assignee_due_date

-- DROP INDEX IF EXISTS sts_ts.idx_subtasks_assignee_due_date;

CREATE INDEX IF NOT EXISTS idx_subtasks_assignee_due_date
    ON sts_ts.subtasks USING btree
    (assignee COLLATE pg_catalog."default" ASC NULLS LAST, due_date ASC NULLS LAST)
    TABLESPACE pg_default
    WHERE status_code::text <> ALL (ARRAY['STS002'::character varying, 'STS010'::character varying]::text[]);
-- Index: idx_subtasks_assignee_status

-- DROP INDEX IF EXISTS sts_ts.idx_subtasks_assignee_status;

CREATE INDEX IF NOT EXISTS idx_subtasks_assignee_status
    ON sts_ts.subtasks USING btree
    (assignee COLLATE pg_catalog."default" ASC NULLS LAST, status_code COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_subtasks_status_code

-- DROP INDEX IF EXISTS sts_ts.idx_subtasks_status_code;

CREATE INDEX IF NOT EXISTS idx_subtasks_status_code
    ON sts_ts.subtasks USING btree
    (status_code COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_subtasks_task_id

-- DROP INDEX IF EXISTS sts_ts.idx_subtasks_task_id;

CREATE INDEX IF NOT EXISTS idx_subtasks_task_id
    ON sts_ts.subtasks USING btree
    (task_id ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_subtasks_task_status

-- DROP INDEX IF EXISTS sts_ts.idx_subtasks_task_status;

CREATE INDEX IF NOT EXISTS idx_subtasks_task_status
    ON sts_ts.subtasks USING btree
    (task_id ASC NULLS LAST, status_code COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;