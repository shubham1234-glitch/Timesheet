-- Table: sts_ts.task_type_master

-- DROP TABLE IF EXISTS sts_ts.task_type_master;

CREATE TABLE IF NOT EXISTS sts_ts.task_type_master
(
    id integer NOT NULL,
    type_code character varying(30) COLLATE pg_catalog."default" NOT NULL,
    type_name character varying(100) COLLATE pg_catalog."default" NOT NULL,
    type_description text COLLATE pg_catalog."default",
    is_billable boolean DEFAULT true,
    is_travel_required boolean DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    created_by character varying(30) COLLATE pg_catalog."default" NOT NULL,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_by character varying(30) COLLATE pg_catalog."default",
    updated_at timestamp without time zone,
    CONSTRAINT task_type_master_pkey PRIMARY KEY (id),
    CONSTRAINT task_type_master_type_code_key UNIQUE (type_code),
    CONSTRAINT fk_task_type_master_created_by FOREIGN KEY (created_by)
        REFERENCES sts_new.user_master (user_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_task_type_master_updated_by FOREIGN KEY (updated_by)
        REFERENCES sts_new.user_master (user_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS sts_ts.task_type_master
    OWNER to sts_ts;

REVOKE ALL ON TABLE sts_ts.task_type_master FROM sukraa_analyst;
REVOKE ALL ON TABLE sts_ts.task_type_master FROM sukraa_dev;

GRANT ALL ON TABLE sts_ts.task_type_master TO sts_ts;

GRANT SELECT ON TABLE sts_ts.task_type_master TO sukraa_analyst;

GRANT DELETE, INSERT, UPDATE, SELECT ON TABLE sts_ts.task_type_master TO sukraa_dev;

COMMENT ON TABLE sts_ts.task_type_master
    IS 'Master table for task types. Task types categorize different kinds of work (e.g., Development, Testing, Documentation, Support, etc.)';

COMMENT ON COLUMN sts_ts.task_type_master.type_code
    IS 'Unique task type code (e.g., TT001, TT002, TT003, etc.)';

COMMENT ON COLUMN sts_ts.task_type_master.type_name
    IS 'Human-readable task type name (e.g., Development, Testing, Documentation, Support, etc.)';

COMMENT ON COLUMN sts_ts.task_type_master.type_description
    IS 'Detailed description of what this task type represents';

COMMENT ON COLUMN sts_ts.task_type_master.is_billable
    IS 'Whether tasks of this type are typically billable to clients';

COMMENT ON COLUMN sts_ts.task_type_master.is_travel_required
    IS 'Whether tasks of this type typically require travel';

COMMENT ON COLUMN sts_ts.task_type_master.is_active
    IS 'Whether this task type is currently active and available for use';
-- Index: idx_task_type_master_is_active

-- DROP INDEX IF EXISTS sts_ts.idx_task_type_master_is_active;

CREATE INDEX IF NOT EXISTS idx_task_type_master_is_active
    ON sts_ts.task_type_master USING btree
    (is_active ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_task_type_master_type_code

-- DROP INDEX IF EXISTS sts_ts.idx_task_type_master_type_code;

CREATE INDEX IF NOT EXISTS idx_task_type_master_type_code
    ON sts_ts.task_type_master USING btree
    (type_code COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;