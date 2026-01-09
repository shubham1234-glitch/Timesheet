-- Table: sts_ts.timesheet_entry

-- DROP TABLE IF EXISTS sts_ts.timesheet_entry;

CREATE TABLE IF NOT EXISTS sts_ts.timesheet_entry
(
    id integer NOT NULL DEFAULT nextval('timesheet_entry_id_seq'::regclass),
    task_code integer,
    epic_code integer,
    activity_code integer,
    ticket_code integer,
    subtask_code integer,
    entry_date date,
    user_code character varying(50) COLLATE pg_catalog."default" NOT NULL,
    approval_status character varying(20) COLLATE pg_catalog."default" NOT NULL DEFAULT 'DRAFT'::character varying,
    actual_hours_worked numeric(4,2) DEFAULT 0,
    travel_time numeric(4,2) DEFAULT 0,
    waiting_time numeric(4,2) DEFAULT 0,
    total_hours numeric(4,2) DEFAULT 0,
    work_location character varying(20) COLLATE pg_catalog."default",
    task_type_code character varying(30) COLLATE pg_catalog."default",
    description text COLLATE pg_catalog."default",
    submitted_by character varying(50) COLLATE pg_catalog."default",
    submitted_at timestamp without time zone,
    approved_by character varying(50) COLLATE pg_catalog."default",
    approved_at timestamp without time zone,
    rejected_by character varying(50) COLLATE pg_catalog."default",
    rejected_at timestamp without time zone,
    rejection_reason text COLLATE pg_catalog."default",
    created_by character varying(50) COLLATE pg_catalog."default" NOT NULL DEFAULT CURRENT_USER,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_by character varying(50) COLLATE pg_catalog."default",
    updated_at timestamp without time zone,
    CONSTRAINT timesheet_entry_pkey PRIMARY KEY (id),
    CONSTRAINT fk_timesheet_entry_activity FOREIGN KEY (activity_code)
        REFERENCES sts_ts.activities (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_timesheet_entry_approved_by FOREIGN KEY (approved_by)
        REFERENCES sts_new.user_master (user_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_timesheet_entry_created_by FOREIGN KEY (created_by)
        REFERENCES sts_new.user_master (user_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_timesheet_entry_epic FOREIGN KEY (epic_code)
        REFERENCES sts_ts.epics (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_timesheet_entry_rejected_by FOREIGN KEY (rejected_by)
        REFERENCES sts_new.user_master (user_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_timesheet_entry_submitted_by FOREIGN KEY (submitted_by)
        REFERENCES sts_new.user_master (user_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_timesheet_entry_subtask FOREIGN KEY (subtask_code)
        REFERENCES sts_ts.subtasks (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_timesheet_entry_task FOREIGN KEY (task_code)
        REFERENCES sts_ts.tasks (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_timesheet_entry_task_type FOREIGN KEY (task_type_code)
        REFERENCES sts_ts.task_type_master (type_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_timesheet_entry_ticket FOREIGN KEY (ticket_code)
        REFERENCES sts_new.ticket_master (ticket_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_timesheet_entry_updated_by FOREIGN KEY (updated_by)
        REFERENCES sts_new.user_master (user_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_timesheet_entry_user FOREIGN KEY (user_code)
        REFERENCES sts_new.user_master (user_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT chk_timesheet_entry_work_location CHECK (work_location IS NULL OR (work_location::text = ANY (ARRAY['REMOTE'::character varying, 'ON_SITE'::character varying, 'OFFICE'::character varying]::text[]))),
    CONSTRAINT chk_timesheet_entry_approval_status CHECK (approval_status::text = ANY (ARRAY['DRAFT'::character varying, 'SUBMITTED'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying]::text[])),
    CONSTRAINT chk_timesheet_entry_parent CHECK (task_code IS NOT NULL AND activity_code IS NULL AND ticket_code IS NULL AND subtask_code IS NULL OR task_code IS NULL AND activity_code IS NOT NULL AND ticket_code IS NULL AND subtask_code IS NULL OR task_code IS NULL AND activity_code IS NULL AND ticket_code IS NOT NULL AND subtask_code IS NULL OR task_code IS NULL AND activity_code IS NULL AND ticket_code IS NULL AND subtask_code IS NOT NULL OR task_code IS NULL AND activity_code IS NULL AND ticket_code IS NULL AND subtask_code IS NULL AND approval_status::text = 'DRAFT'::text)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS sts_ts.timesheet_entry
    OWNER to sts_ts;

REVOKE ALL ON TABLE sts_ts.timesheet_entry FROM sukraa_analyst;
REVOKE ALL ON TABLE sts_ts.timesheet_entry FROM sukraa_dev;

GRANT ALL ON TABLE sts_ts.timesheet_entry TO sts_ts;

GRANT SELECT ON TABLE sts_ts.timesheet_entry TO sukraa_analyst;

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE sts_ts.timesheet_entry TO sukraa_dev;
-- Index: idx_timesheet_entry_activity_code

-- DROP INDEX IF EXISTS sts_ts.idx_timesheet_entry_activity_code;

CREATE INDEX IF NOT EXISTS idx_timesheet_entry_activity_code
    ON sts_ts.timesheet_entry USING btree
    (activity_code ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_timesheet_entry_approval_status

-- DROP INDEX IF EXISTS sts_ts.idx_timesheet_entry_approval_status;

CREATE INDEX IF NOT EXISTS idx_timesheet_entry_approval_status
    ON sts_ts.timesheet_entry USING btree
    (approval_status COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_timesheet_entry_entry_date

-- DROP INDEX IF EXISTS sts_ts.idx_timesheet_entry_entry_date;

CREATE INDEX IF NOT EXISTS idx_timesheet_entry_entry_date
    ON sts_ts.timesheet_entry USING btree
    (entry_date ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_timesheet_entry_epic_code

-- DROP INDEX IF EXISTS sts_ts.idx_timesheet_entry_epic_code;

CREATE INDEX IF NOT EXISTS idx_timesheet_entry_epic_code
    ON sts_ts.timesheet_entry USING btree
    (epic_code ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_timesheet_entry_epic_date

-- DROP INDEX IF EXISTS sts_ts.idx_timesheet_entry_epic_date;

CREATE INDEX IF NOT EXISTS idx_timesheet_entry_epic_date
    ON sts_ts.timesheet_entry USING btree
    (epic_code ASC NULLS LAST, entry_date ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_timesheet_entry_subtask_code

-- DROP INDEX IF EXISTS sts_ts.idx_timesheet_entry_subtask_code;

CREATE INDEX IF NOT EXISTS idx_timesheet_entry_subtask_code
    ON sts_ts.timesheet_entry USING btree
    (subtask_code ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_timesheet_entry_task_code

-- DROP INDEX IF EXISTS sts_ts.idx_timesheet_entry_task_code;

CREATE INDEX IF NOT EXISTS idx_timesheet_entry_task_code
    ON sts_ts.timesheet_entry USING btree
    (task_code ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_timesheet_entry_task_type_code

-- DROP INDEX IF EXISTS sts_ts.idx_timesheet_entry_task_type_code;

CREATE INDEX IF NOT EXISTS idx_timesheet_entry_task_type_code
    ON sts_ts.timesheet_entry USING btree
    (task_type_code COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_timesheet_entry_ticket_code

-- DROP INDEX IF EXISTS sts_ts.idx_timesheet_entry_ticket_code;

CREATE INDEX IF NOT EXISTS idx_timesheet_entry_ticket_code
    ON sts_ts.timesheet_entry USING btree
    (ticket_code ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_timesheet_entry_user_code

-- DROP INDEX IF EXISTS sts_ts.idx_timesheet_entry_user_code;

CREATE INDEX IF NOT EXISTS idx_timesheet_entry_user_code
    ON sts_ts.timesheet_entry USING btree
    (user_code COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_timesheet_entry_user_date

-- DROP INDEX IF EXISTS sts_ts.idx_timesheet_entry_user_date;

CREATE INDEX IF NOT EXISTS idx_timesheet_entry_user_date
    ON sts_ts.timesheet_entry USING btree
    (user_code COLLATE pg_catalog."default" ASC NULLS LAST, entry_date ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_timesheet_entry_user_date_status

-- DROP INDEX IF EXISTS sts_ts.idx_timesheet_entry_user_date_status;

CREATE INDEX IF NOT EXISTS idx_timesheet_entry_user_date_status
    ON sts_ts.timesheet_entry USING btree
    (user_code COLLATE pg_catalog."default" ASC NULLS LAST, entry_date ASC NULLS LAST, approval_status COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;