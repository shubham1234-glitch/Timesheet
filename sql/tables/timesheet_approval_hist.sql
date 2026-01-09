-- Table: sts_ts.timesheet_approval_hist

-- DROP TABLE IF EXISTS sts_ts.timesheet_approval_hist;

CREATE TABLE IF NOT EXISTS sts_ts.timesheet_approval_hist
(
    id integer NOT NULL DEFAULT nextval('timesheet_approval_hist_id_seq'::regclass),
    entry_id integer NOT NULL,
    approval_status character varying(30) COLLATE pg_catalog."default" NOT NULL,
    status_reason text COLLATE pg_catalog."default",
    entry_user_code character varying(50) COLLATE pg_catalog."default" NOT NULL,
    entry_date date,
    task_code integer,
    epic_code integer,
    activity_code integer,
    ticket_code integer,
    subtask_code integer,
    actual_hours_worked numeric(4,2) DEFAULT 0,
    travel_time numeric(4,2) DEFAULT 0,
    waiting_time numeric(4,2) DEFAULT 0,
    total_hours numeric(4,2) DEFAULT 0,
    submitted_by character varying(50) COLLATE pg_catalog."default",
    submitted_at timestamp without time zone,
    approved_by character varying(50) COLLATE pg_catalog."default",
    approved_at timestamp without time zone,
    rejected_by character varying(50) COLLATE pg_catalog."default",
    rejected_at timestamp without time zone,
    created_by character varying(50) COLLATE pg_catalog."default" NOT NULL DEFAULT CURRENT_USER,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    CONSTRAINT timesheet_approval_hist_pkey PRIMARY KEY (id),
    CONSTRAINT fk_timesheet_approval_hist_activity FOREIGN KEY (activity_code)
        REFERENCES sts_ts.activities (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_timesheet_approval_hist_approved_by FOREIGN KEY (approved_by)
        REFERENCES sts_new.user_master (user_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_timesheet_approval_hist_created_by FOREIGN KEY (created_by)
        REFERENCES sts_new.user_master (user_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_timesheet_approval_hist_entry_id FOREIGN KEY (entry_id)
        REFERENCES sts_ts.timesheet_entry (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE,
    CONSTRAINT fk_timesheet_approval_hist_entry_user_code FOREIGN KEY (entry_user_code)
        REFERENCES sts_new.user_master (user_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_timesheet_approval_hist_epic FOREIGN KEY (epic_code)
        REFERENCES sts_ts.epics (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_timesheet_approval_hist_rejected_by FOREIGN KEY (rejected_by)
        REFERENCES sts_new.user_master (user_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_timesheet_approval_hist_submitted_by FOREIGN KEY (submitted_by)
        REFERENCES sts_new.user_master (user_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_timesheet_approval_hist_subtask FOREIGN KEY (subtask_code)
        REFERENCES sts_ts.subtasks (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_timesheet_approval_hist_task FOREIGN KEY (task_code)
        REFERENCES sts_ts.tasks (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_timesheet_approval_hist_ticket FOREIGN KEY (ticket_code)
        REFERENCES sts_new.ticket_master (ticket_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT chk_timesheet_approval_hist_approval_status CHECK (approval_status::text = ANY (ARRAY['DRAFT'::character varying, 'SUBMITTED'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying]::text[]))
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS sts_ts.timesheet_approval_hist
    OWNER to sts_ts;

REVOKE ALL ON TABLE sts_ts.timesheet_approval_hist FROM sukraa_analyst;
REVOKE ALL ON TABLE sts_ts.timesheet_approval_hist FROM sukraa_dev;

GRANT ALL ON TABLE sts_ts.timesheet_approval_hist TO sts_ts;

GRANT SELECT ON TABLE sts_ts.timesheet_approval_hist TO sukraa_analyst;

GRANT DELETE, INSERT, UPDATE, SELECT ON TABLE sts_ts.timesheet_approval_hist TO sukraa_dev;
-- Index: idx_timesheet_approval_hist_activity_code

-- DROP INDEX IF EXISTS sts_ts.idx_timesheet_approval_hist_activity_code;

CREATE INDEX IF NOT EXISTS idx_timesheet_approval_hist_activity_code
    ON sts_ts.timesheet_approval_hist USING btree
    (activity_code ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_timesheet_approval_hist_approval_status

-- DROP INDEX IF EXISTS sts_ts.idx_timesheet_approval_hist_approval_status;

CREATE INDEX IF NOT EXISTS idx_timesheet_approval_hist_approval_status
    ON sts_ts.timesheet_approval_hist USING btree
    (approval_status COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_timesheet_approval_hist_created_at

-- DROP INDEX IF EXISTS sts_ts.idx_timesheet_approval_hist_created_at;

CREATE INDEX IF NOT EXISTS idx_timesheet_approval_hist_created_at
    ON sts_ts.timesheet_approval_hist USING btree
    (created_at DESC NULLS FIRST)
    TABLESPACE pg_default;
-- Index: idx_timesheet_approval_hist_entry_created

-- DROP INDEX IF EXISTS sts_ts.idx_timesheet_approval_hist_entry_created;

CREATE INDEX IF NOT EXISTS idx_timesheet_approval_hist_entry_created
    ON sts_ts.timesheet_approval_hist USING btree
    (entry_id ASC NULLS LAST, created_at DESC NULLS FIRST)
    TABLESPACE pg_default;
-- Index: idx_timesheet_approval_hist_entry_date

-- DROP INDEX IF EXISTS sts_ts.idx_timesheet_approval_hist_entry_date;

CREATE INDEX IF NOT EXISTS idx_timesheet_approval_hist_entry_date
    ON sts_ts.timesheet_approval_hist USING btree
    (entry_date ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_timesheet_approval_hist_entry_id

-- DROP INDEX IF EXISTS sts_ts.idx_timesheet_approval_hist_entry_id;

CREATE INDEX IF NOT EXISTS idx_timesheet_approval_hist_entry_id
    ON sts_ts.timesheet_approval_hist USING btree
    (entry_id ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_timesheet_approval_hist_entry_id_status

-- DROP INDEX IF EXISTS sts_ts.idx_timesheet_approval_hist_entry_id_status;

CREATE INDEX IF NOT EXISTS idx_timesheet_approval_hist_entry_id_status
    ON sts_ts.timesheet_approval_hist USING btree
    (entry_id ASC NULLS LAST, approval_status COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_timesheet_approval_hist_entry_user_code

-- DROP INDEX IF EXISTS sts_ts.idx_timesheet_approval_hist_entry_user_code;

CREATE INDEX IF NOT EXISTS idx_timesheet_approval_hist_entry_user_code
    ON sts_ts.timesheet_approval_hist USING btree
    (entry_user_code COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_timesheet_approval_hist_epic_code

-- DROP INDEX IF EXISTS sts_ts.idx_timesheet_approval_hist_epic_code;

CREATE INDEX IF NOT EXISTS idx_timesheet_approval_hist_epic_code
    ON sts_ts.timesheet_approval_hist USING btree
    (epic_code ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_timesheet_approval_hist_subtask_code

-- DROP INDEX IF EXISTS sts_ts.idx_timesheet_approval_hist_subtask_code;

CREATE INDEX IF NOT EXISTS idx_timesheet_approval_hist_subtask_code
    ON sts_ts.timesheet_approval_hist USING btree
    (subtask_code ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_timesheet_approval_hist_task_code

-- DROP INDEX IF EXISTS sts_ts.idx_timesheet_approval_hist_task_code;

CREATE INDEX IF NOT EXISTS idx_timesheet_approval_hist_task_code
    ON sts_ts.timesheet_approval_hist USING btree
    (task_code ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_timesheet_approval_hist_ticket_code

-- DROP INDEX IF EXISTS sts_ts.idx_timesheet_approval_hist_ticket_code;

CREATE INDEX IF NOT EXISTS idx_timesheet_approval_hist_ticket_code
    ON sts_ts.timesheet_approval_hist USING btree
    (ticket_code ASC NULLS LAST)
    TABLESPACE pg_default;