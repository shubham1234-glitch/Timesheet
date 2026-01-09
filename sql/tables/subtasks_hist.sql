-- Table: sts_ts.subtask_hist

-- DROP TABLE IF EXISTS sts_ts.subtask_hist;

CREATE TABLE IF NOT EXISTS sts_ts.subtask_hist
(
    id integer NOT NULL DEFAULT nextval('subtask_hist_id_seq'::regclass),
    subtask_code integer NOT NULL,
    status_code character varying(30) COLLATE pg_catalog."default",
    priority_code integer,
    status_reason text COLLATE pg_catalog."default",
    assigned_team_code character varying(10) COLLATE pg_catalog."default",
    assignee character varying(50) COLLATE pg_catalog."default",
    work_mode character varying(30) COLLATE pg_catalog."default",
    start_date date,
    due_date date,
    closed_on date,
    estimated_hours numeric(6,2),
    estimated_days numeric(6,2),
    cancelled_by character varying(50) COLLATE pg_catalog."default",
    cancelled_at date,
    created_by character varying(30) COLLATE pg_catalog."default" NOT NULL DEFAULT CURRENT_USER,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    CONSTRAINT subtask_hist_pkey PRIMARY KEY (id),
    CONSTRAINT fk_subtask_hist_assigned_team FOREIGN KEY (assigned_team_code)
        REFERENCES sts_new.team_master (team_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_subtask_hist_assignee FOREIGN KEY (assignee)
        REFERENCES sts_new.user_master (user_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_subtask_hist_cancelled_by FOREIGN KEY (cancelled_by)
        REFERENCES sts_new.user_master (user_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_subtask_hist_created_by FOREIGN KEY (created_by)
        REFERENCES sts_new.user_master (user_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_subtask_hist_priority FOREIGN KEY (priority_code)
        REFERENCES sts_new.tkt_priority_master (priority_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_subtask_hist_status FOREIGN KEY (status_code)
        REFERENCES sts_new.status_master (status_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_subtask_hist_subtask_code FOREIGN KEY (subtask_code)
        REFERENCES sts_ts.subtasks (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE,
    CONSTRAINT chk_subtask_hist_status_code CHECK (status_code::text = ANY (ARRAY['STS001'::character varying, 'STS007'::character varying, 'STS002'::character varying, 'STS010'::character varying]::text[])),
    CONSTRAINT chk_subtask_hist_work_mode CHECK (work_mode IS NULL OR (work_mode::text = ANY (ARRAY['REMOTE'::character varying, 'ON_SITE'::character varying, 'OFFICE'::character varying]::text[])))
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS sts_ts.subtask_hist
    OWNER to sts_ts;

REVOKE ALL ON TABLE sts_ts.subtask_hist FROM sukraa_analyst;
REVOKE ALL ON TABLE sts_ts.subtask_hist FROM sukraa_dev;

GRANT ALL ON TABLE sts_ts.subtask_hist TO sts_ts;

GRANT SELECT ON TABLE sts_ts.subtask_hist TO sukraa_analyst;

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE sts_ts.subtask_hist TO sukraa_dev;

COMMENT ON CONSTRAINT chk_subtask_hist_status_code ON sts_ts.subtask_hist
    IS 'Status code constraint: Only allows STS001 (Not Yet Started), STS007 (In Progress), STS002 (Completed), STS010 (Cancelled).';
-- Index: idx_subtask_hist_assigned_team_code

-- DROP INDEX IF EXISTS sts_ts.idx_subtask_hist_assigned_team_code;

CREATE INDEX IF NOT EXISTS idx_subtask_hist_assigned_team_code
    ON sts_ts.subtask_hist USING btree
    (assigned_team_code COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_subtask_hist_assignee

-- DROP INDEX IF EXISTS sts_ts.idx_subtask_hist_assignee;

CREATE INDEX IF NOT EXISTS idx_subtask_hist_assignee
    ON sts_ts.subtask_hist USING btree
    (assignee COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_subtask_hist_created_at

-- DROP INDEX IF EXISTS sts_ts.idx_subtask_hist_created_at;

CREATE INDEX IF NOT EXISTS idx_subtask_hist_created_at
    ON sts_ts.subtask_hist USING btree
    (created_at DESC NULLS FIRST)
    TABLESPACE pg_default;
-- Index: idx_subtask_hist_priority_code

-- DROP INDEX IF EXISTS sts_ts.idx_subtask_hist_priority_code;

CREATE INDEX IF NOT EXISTS idx_subtask_hist_priority_code
    ON sts_ts.subtask_hist USING btree
    (priority_code ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_subtask_hist_status_code

-- DROP INDEX IF EXISTS sts_ts.idx_subtask_hist_status_code;

CREATE INDEX IF NOT EXISTS idx_subtask_hist_status_code
    ON sts_ts.subtask_hist USING btree
    (status_code COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_subtask_hist_status_created

-- DROP INDEX IF EXISTS sts_ts.idx_subtask_hist_status_created;

CREATE INDEX IF NOT EXISTS idx_subtask_hist_status_created
    ON sts_ts.subtask_hist USING btree
    (status_code COLLATE pg_catalog."default" ASC NULLS LAST, created_at DESC NULLS FIRST)
    TABLESPACE pg_default;
-- Index: idx_subtask_hist_subtask_code

-- DROP INDEX IF EXISTS sts_ts.idx_subtask_hist_subtask_code;

CREATE INDEX IF NOT EXISTS idx_subtask_hist_subtask_code
    ON sts_ts.subtask_hist USING btree
    (subtask_code ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_subtask_hist_subtask_code_created_at_id

-- DROP INDEX IF EXISTS sts_ts.idx_subtask_hist_subtask_code_created_at_id;

CREATE INDEX IF NOT EXISTS idx_subtask_hist_subtask_code_created_at_id
    ON sts_ts.subtask_hist USING btree
    (subtask_code ASC NULLS LAST, created_at DESC NULLS FIRST, id DESC NULLS FIRST)
    TABLESPACE pg_default;
-- Index: idx_subtask_hist_work_mode

-- DROP INDEX IF EXISTS sts_ts.idx_subtask_hist_work_mode;

CREATE INDEX IF NOT EXISTS idx_subtask_hist_work_mode
    ON sts_ts.subtask_hist USING btree
    (work_mode COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;