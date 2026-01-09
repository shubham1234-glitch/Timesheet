-- Table: sts_ts.leave_type_master

-- DROP TABLE IF EXISTS sts_ts.leave_type_master;

CREATE TABLE IF NOT EXISTS sts_ts.leave_type_master
(
    id integer NOT NULL,
    leave_type_code character varying(20) COLLATE pg_catalog."default" NOT NULL,
    leave_type_name character varying(50) COLLATE pg_catalog."default" NOT NULL,
    leave_type_description text COLLATE pg_catalog."default",
    is_active boolean NOT NULL DEFAULT true,
    created_by character varying(30) COLLATE pg_catalog."default" NOT NULL,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_by character varying(30) COLLATE pg_catalog."default",
    updated_at timestamp without time zone,
    CONSTRAINT leave_type_master_pkey PRIMARY KEY (id),
    CONSTRAINT leave_type_master_leave_type_code_key UNIQUE (leave_type_code),
    CONSTRAINT leave_type_master_leave_type_name_key UNIQUE (leave_type_name),
    CONSTRAINT fk_leave_type_master_created_by FOREIGN KEY (created_by)
        REFERENCES sts_new.user_master (user_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_leave_type_master_updated_by FOREIGN KEY (updated_by)
        REFERENCES sts_new.user_master (user_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS sts_ts.leave_type_master
    OWNER to sts_ts;

REVOKE ALL ON TABLE sts_ts.leave_type_master FROM sukraa_analyst;
REVOKE ALL ON TABLE sts_ts.leave_type_master FROM sukraa_dev;

GRANT ALL ON TABLE sts_ts.leave_type_master TO sts_ts;

GRANT SELECT ON TABLE sts_ts.leave_type_master TO sukraa_analyst;

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE sts_ts.leave_type_master TO sukraa_dev;

COMMENT ON TABLE sts_ts.leave_type_master
    IS 'Master table for leave types';

COMMENT ON COLUMN sts_ts.leave_type_master.leave_type_code
    IS 'Unique leave type code (e.g., LT001, LT002, LT003, etc.)';

COMMENT ON COLUMN sts_ts.leave_type_master.leave_type_name
    IS 'Human-readable leave type name (e.g., Casual Leave, Sick Leave, Privilege Leave, Compensatory Off, Permission, Half Day Leave)';

COMMENT ON COLUMN sts_ts.leave_type_master.leave_type_description
    IS 'Detailed description of the leave type';

COMMENT ON COLUMN sts_ts.leave_type_master.is_active
    IS 'Whether this leave type is currently active';
-- Index: idx_leave_type_master_is_active

-- DROP INDEX IF EXISTS sts_ts.idx_leave_type_master_is_active;

CREATE INDEX IF NOT EXISTS idx_leave_type_master_is_active
    ON sts_ts.leave_type_master USING btree
    (is_active ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_leave_type_master_leave_type_code

-- DROP INDEX IF EXISTS sts_ts.idx_leave_type_master_leave_type_code;

CREATE INDEX IF NOT EXISTS idx_leave_type_master_leave_type_code
    ON sts_ts.leave_type_master USING btree
    (leave_type_code COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;