-- Table: sts_ts.tasks

-- DROP TABLE IF EXISTS sts_ts.tasks;

CREATE TABLE IF NOT EXISTS sts_ts.tasks
(
    id integer NOT NULL DEFAULT nextval('tasks_id_seq'::regclass),
    task_title character varying(255) COLLATE pg_catalog."default" NOT NULL,
    description text COLLATE pg_catalog."default",
    epic_code integer NOT NULL,
    predefined_task_id integer,
    product_code character varying(10) COLLATE pg_catalog."default",
    assignee character varying(50) COLLATE pg_catalog."default",
    reporter character varying(50) COLLATE pg_catalog."default",
    assigned_team_code character varying(10) COLLATE pg_catalog."default",
    status_code character varying(30) COLLATE pg_catalog."default" NOT NULL,
    priority_code integer NOT NULL,
    task_type_code character varying(30) COLLATE pg_catalog."default",
    work_mode character varying(30) COLLATE pg_catalog."default",
    assigned_on date,
    start_date date,
    due_date date NOT NULL,
    closed_on date,
    estimated_hours numeric(6,2) NOT NULL,
    estimated_days numeric(6,2) NOT NULL,
    is_billable boolean DEFAULT true,
    cancelled_by character varying(50) COLLATE pg_catalog."default",
    cancelled_at date,
    cancellation_reason text COLLATE pg_catalog."default",
    created_by character varying(30) COLLATE pg_catalog."default" NOT NULL DEFAULT CURRENT_USER,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_by character varying(30) COLLATE pg_catalog."default",
    updated_at timestamp without time zone,
    CONSTRAINT tasks_pkey PRIMARY KEY (id),
    CONSTRAINT fk_task_assigned_team FOREIGN KEY (assigned_team_code)
        REFERENCES sts_new.team_master (team_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_task_assignee FOREIGN KEY (assignee)
        REFERENCES sts_new.user_master (user_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_task_cancelled_by FOREIGN KEY (cancelled_by)
        REFERENCES sts_new.user_master (user_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_task_created_by FOREIGN KEY (created_by)
        REFERENCES sts_new.user_master (user_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_task_epic FOREIGN KEY (epic_code)
        REFERENCES sts_ts.epics (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_task_predefined_task FOREIGN KEY (predefined_task_id)
        REFERENCES sts_ts.predefined_tasks (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_task_priority FOREIGN KEY (priority_code)
        REFERENCES sts_new.tkt_priority_master (priority_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_task_product FOREIGN KEY (product_code)
        REFERENCES sts_new.product_master (product_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_task_reporter FOREIGN KEY (reporter)
        REFERENCES sts_new.user_master (user_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_task_status FOREIGN KEY (status_code)
        REFERENCES sts_new.status_master (status_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_task_task_type FOREIGN KEY (task_type_code)
        REFERENCES sts_ts.task_type_master (type_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_task_updated_by FOREIGN KEY (updated_by)
        REFERENCES sts_new.user_master (user_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT chk_tasks_status_code CHECK (status_code::text = ANY (ARRAY['STS001'::character varying, 'STS007'::character varying, 'STS002'::character varying, 'STS010'::character varying]::text[])),
    CONSTRAINT chk_tasks_work_mode CHECK (work_mode IS NULL OR (work_mode::text = ANY (ARRAY['REMOTE'::character varying, 'ON_SITE'::character varying, 'OFFICE'::character varying]::text[])))
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS sts_ts.tasks
    OWNER to sts_ts;

REVOKE ALL ON TABLE sts_ts.tasks FROM sukraa_analyst;
REVOKE ALL ON TABLE sts_ts.tasks FROM sukraa_dev;

GRANT ALL ON TABLE sts_ts.tasks TO sts_ts;

GRANT SELECT ON TABLE sts_ts.tasks TO sukraa_analyst;

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE sts_ts.tasks TO sukraa_dev;
-- Index: idx_tasks_assigned_team_code

-- DROP INDEX IF EXISTS sts_ts.idx_tasks_assigned_team_code;

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_team_code
    ON sts_ts.tasks USING btree
    (assigned_team_code COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_tasks_assignee

-- DROP INDEX IF EXISTS sts_ts.idx_tasks_assignee;

CREATE INDEX IF NOT EXISTS idx_tasks_assignee
    ON sts_ts.tasks USING btree
    (assignee COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_tasks_assignee_due_date

-- DROP INDEX IF EXISTS sts_ts.idx_tasks_assignee_due_date;

CREATE INDEX IF NOT EXISTS idx_tasks_assignee_due_date
    ON sts_ts.tasks USING btree
    (assignee COLLATE pg_catalog."default" ASC NULLS LAST, due_date ASC NULLS LAST)
    TABLESPACE pg_default
    WHERE status_code::text <> ALL (ARRAY['STS002'::character varying, 'STS010'::character varying]::text[]);
-- Index: idx_tasks_assignee_status

-- DROP INDEX IF EXISTS sts_ts.idx_tasks_assignee_status;

CREATE INDEX IF NOT EXISTS idx_tasks_assignee_status
    ON sts_ts.tasks USING btree
    (assignee COLLATE pg_catalog."default" ASC NULLS LAST, status_code COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_tasks_epic_code

-- DROP INDEX IF EXISTS sts_ts.idx_tasks_epic_code;

CREATE INDEX IF NOT EXISTS idx_tasks_epic_code
    ON sts_ts.tasks USING btree
    (epic_code ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_tasks_epic_predefined_task

-- DROP INDEX IF EXISTS sts_ts.idx_tasks_epic_predefined_task;

CREATE INDEX IF NOT EXISTS idx_tasks_epic_predefined_task
    ON sts_ts.tasks USING btree
    (epic_code ASC NULLS LAST, predefined_task_id ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_tasks_epic_status

-- DROP INDEX IF EXISTS sts_ts.idx_tasks_epic_status;

CREATE INDEX IF NOT EXISTS idx_tasks_epic_status
    ON sts_ts.tasks USING btree
    (epic_code ASC NULLS LAST, status_code COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_tasks_predefined_task_id

-- DROP INDEX IF EXISTS sts_ts.idx_tasks_predefined_task_id;

CREATE INDEX IF NOT EXISTS idx_tasks_predefined_task_id
    ON sts_ts.tasks USING btree
    (predefined_task_id ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_tasks_product_code

-- DROP INDEX IF EXISTS sts_ts.idx_tasks_product_code;

CREATE INDEX IF NOT EXISTS idx_tasks_product_code
    ON sts_ts.tasks USING btree
    (product_code COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_tasks_reporter

-- DROP INDEX IF EXISTS sts_ts.idx_tasks_reporter;

CREATE INDEX IF NOT EXISTS idx_tasks_reporter
    ON sts_ts.tasks USING btree
    (reporter COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_tasks_status_code

-- DROP INDEX IF EXISTS sts_ts.idx_tasks_status_code;

CREATE INDEX IF NOT EXISTS idx_tasks_status_code
    ON sts_ts.tasks USING btree
    (status_code COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_tasks_task_type_code

-- DROP INDEX IF EXISTS sts_ts.idx_tasks_task_type_code;

CREATE INDEX IF NOT EXISTS idx_tasks_task_type_code
    ON sts_ts.tasks USING btree
    (task_type_code COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_tasks_work_mode

-- DROP INDEX IF EXISTS sts_ts.idx_tasks_work_mode;

CREATE INDEX IF NOT EXISTS idx_tasks_work_mode
    ON sts_ts.tasks USING btree
    (work_mode COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;