-- Table: sts_ts.predefined_tasks

-- DROP TABLE IF EXISTS sts_ts.predefined_tasks;

CREATE TABLE IF NOT EXISTS sts_ts.predefined_tasks
(
    id integer NOT NULL DEFAULT nextval('predefined_tasks_id_seq'::regclass),
    task_title character varying(255) COLLATE pg_catalog."default" NOT NULL,
    task_description text COLLATE pg_catalog."default",
    status_code character varying(30) COLLATE pg_catalog."default" NOT NULL DEFAULT 'STS001'::character varying,
    priority_code integer NOT NULL,
    task_type_code character varying(30) COLLATE pg_catalog."default",
    work_mode character varying(30) COLLATE pg_catalog."default",
    team_code character varying(10) COLLATE pg_catalog."default",
    predefined_epic_id integer,
    estimated_hours numeric(6,2) NOT NULL,
    estimated_days numeric(6,2) NOT NULL,
    is_billable boolean DEFAULT true,
    created_by character varying(30) COLLATE pg_catalog."default" NOT NULL,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_by character varying(30) COLLATE pg_catalog."default",
    updated_at timestamp without time zone,
    CONSTRAINT predefined_tasks_pkey PRIMARY KEY (id),
    CONSTRAINT fk_predef_task_created_by FOREIGN KEY (created_by)
        REFERENCES sts_new.user_master (user_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_predef_task_predefined_epic FOREIGN KEY (predefined_epic_id)
        REFERENCES sts_ts.predefined_epics (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE SET NULL,
    CONSTRAINT fk_predef_task_priority FOREIGN KEY (priority_code)
        REFERENCES sts_new.tkt_priority_master (priority_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_predef_task_status FOREIGN KEY (status_code)
        REFERENCES sts_new.status_master (status_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_predef_task_task_type FOREIGN KEY (task_type_code)
        REFERENCES sts_ts.task_type_master (type_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_predef_task_team FOREIGN KEY (team_code)
        REFERENCES sts_new.team_master (team_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_predef_task_updated_by FOREIGN KEY (updated_by)
        REFERENCES sts_new.user_master (user_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT chk_predef_task_status_code CHECK (status_code::text = ANY (ARRAY['STS001'::character varying, 'STS007'::character varying, 'STS002'::character varying, 'STS010'::character varying]::text[])),
    CONSTRAINT chk_predef_task_work_mode CHECK (work_mode IS NULL OR (work_mode::text = ANY (ARRAY['REMOTE'::character varying, 'ON_SITE'::character varying, 'OFFICE'::character varying]::text[])))
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS sts_ts.predefined_tasks
    OWNER to sts_ts;

REVOKE ALL ON TABLE sts_ts.predefined_tasks FROM sukraa_analyst;
REVOKE ALL ON TABLE sts_ts.predefined_tasks FROM sukraa_dev;

GRANT ALL ON TABLE sts_ts.predefined_tasks TO sts_ts;

GRANT SELECT ON TABLE sts_ts.predefined_tasks TO sukraa_analyst;

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE sts_ts.predefined_tasks TO sukraa_dev;
-- Index: idx_predef_task_predefined_epic_id

-- DROP INDEX IF EXISTS sts_ts.idx_predef_task_predefined_epic_id;

CREATE INDEX IF NOT EXISTS idx_predef_task_predefined_epic_id
    ON sts_ts.predefined_tasks USING btree
    (predefined_epic_id ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_predef_task_team_code

-- DROP INDEX IF EXISTS sts_ts.idx_predef_task_team_code;

CREATE INDEX IF NOT EXISTS idx_predef_task_team_code
    ON sts_ts.predefined_tasks USING btree
    (team_code COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;