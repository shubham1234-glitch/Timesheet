-- Table: sts_ts.leave_application

-- DROP TABLE IF EXISTS sts_ts.leave_application;

CREATE TABLE IF NOT EXISTS sts_ts.leave_application
(
    id integer NOT NULL DEFAULT nextval('leave_application_id_seq'::regclass),
    user_code character varying(50) COLLATE pg_catalog."default" NOT NULL,
    leave_type_code character varying(20) COLLATE pg_catalog."default" NOT NULL,
    from_date date NOT NULL,
    to_date date NOT NULL,
    duration_days numeric(4,2) NOT NULL,
    duration_hours numeric(4,2),
    reason text COLLATE pg_catalog."default" NOT NULL,
    approval_status character varying(20) COLLATE pg_catalog."default" NOT NULL DEFAULT 'DRAFT'::character varying,
    approved_by character varying(50) COLLATE pg_catalog."default",
    approved_at timestamp without time zone,
    rejected_by character varying(50) COLLATE pg_catalog."default",
    rejected_at timestamp without time zone,
    rejection_reason text COLLATE pg_catalog."default",
    created_by character varying(50) COLLATE pg_catalog."default" NOT NULL DEFAULT CURRENT_USER,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_by character varying(50) COLLATE pg_catalog."default",
    updated_at timestamp without time zone,
    CONSTRAINT leave_application_pkey PRIMARY KEY (id),
    CONSTRAINT fk_leave_application_approved_by FOREIGN KEY (approved_by)
        REFERENCES sts_new.user_master (user_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_leave_application_created_by FOREIGN KEY (created_by)
        REFERENCES sts_new.user_master (user_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_leave_application_leave_type FOREIGN KEY (leave_type_code)
        REFERENCES sts_ts.leave_type_master (leave_type_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_leave_application_rejected_by FOREIGN KEY (rejected_by)
        REFERENCES sts_new.user_master (user_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_leave_application_updated_by FOREIGN KEY (updated_by)
        REFERENCES sts_new.user_master (user_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_leave_application_user FOREIGN KEY (user_code)
        REFERENCES sts_new.user_master (user_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT leave_application_approval_status_check CHECK (approval_status::text = ANY (ARRAY['DRAFT'::character varying::text, 'SUBMITTED'::character varying::text, 'APPROVED'::character varying::text, 'REJECTED'::character varying::text])),
    CONSTRAINT chk_leave_application_approval_status CHECK (approval_status::text = ANY (ARRAY['DRAFT'::character varying, 'SUBMITTED'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying]::text[]))
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS sts_ts.leave_application
    OWNER to sts_ts;

REVOKE ALL ON TABLE sts_ts.leave_application FROM sukraa_analyst;
REVOKE ALL ON TABLE sts_ts.leave_application FROM sukraa_dev;

GRANT ALL ON TABLE sts_ts.leave_application TO sts_ts;

GRANT SELECT ON TABLE sts_ts.leave_application TO sukraa_analyst;

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE sts_ts.leave_application TO sukraa_dev;
-- Index: idx_leave_application_approval_status

-- DROP INDEX IF EXISTS sts_ts.idx_leave_application_approval_status;

CREATE INDEX IF NOT EXISTS idx_leave_application_approval_status
    ON sts_ts.leave_application USING btree
    (approval_status COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_leave_application_from_date

-- DROP INDEX IF EXISTS sts_ts.idx_leave_application_from_date;

CREATE INDEX IF NOT EXISTS idx_leave_application_from_date
    ON sts_ts.leave_application USING btree
    (from_date ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_leave_application_leave_type_code

-- DROP INDEX IF EXISTS sts_ts.idx_leave_application_leave_type_code;

CREATE INDEX IF NOT EXISTS idx_leave_application_leave_type_code
    ON sts_ts.leave_application USING btree
    (leave_type_code COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_leave_application_status_date

-- DROP INDEX IF EXISTS sts_ts.idx_leave_application_status_date;

CREATE INDEX IF NOT EXISTS idx_leave_application_status_date
    ON sts_ts.leave_application USING btree
    (approval_status COLLATE pg_catalog."default" ASC NULLS LAST, from_date ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_leave_application_to_date

-- DROP INDEX IF EXISTS sts_ts.idx_leave_application_to_date;

CREATE INDEX IF NOT EXISTS idx_leave_application_to_date
    ON sts_ts.leave_application USING btree
    (to_date ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_leave_application_user_code

-- DROP INDEX IF EXISTS sts_ts.idx_leave_application_user_code;

CREATE INDEX IF NOT EXISTS idx_leave_application_user_code
    ON sts_ts.leave_application USING btree
    (user_code COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_leave_application_user_date

-- DROP INDEX IF EXISTS sts_ts.idx_leave_application_user_date;

CREATE INDEX IF NOT EXISTS idx_leave_application_user_date
    ON sts_ts.leave_application USING btree
    (user_code COLLATE pg_catalog."default" ASC NULLS LAST, from_date ASC NULLS LAST, to_date ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_leave_application_user_status

-- DROP INDEX IF EXISTS sts_ts.idx_leave_application_user_status;

CREATE INDEX IF NOT EXISTS idx_leave_application_user_status
    ON sts_ts.leave_application USING btree
    (user_code COLLATE pg_catalog."default" ASC NULLS LAST, approval_status COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_leave_application_user_status_date

-- DROP INDEX IF EXISTS sts_ts.idx_leave_application_user_status_date;

CREATE INDEX IF NOT EXISTS idx_leave_application_user_status_date
    ON sts_ts.leave_application USING btree
    (user_code COLLATE pg_catalog."default" ASC NULLS LAST, approval_status COLLATE pg_catalog."default" ASC NULLS LAST, from_date ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_leave_application_user_status_date_composite

-- DROP INDEX IF EXISTS sts_ts.idx_leave_application_user_status_date_composite;

CREATE INDEX IF NOT EXISTS idx_leave_application_user_status_date_composite
    ON sts_ts.leave_application USING btree
    (user_code COLLATE pg_catalog."default" ASC NULLS LAST, approval_status COLLATE pg_catalog."default" ASC NULLS LAST, from_date ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_leave_application_user_status_year

-- DROP INDEX IF EXISTS sts_ts.idx_leave_application_user_status_year;

CREATE INDEX IF NOT EXISTS idx_leave_application_user_status_year
    ON sts_ts.leave_application USING btree
    (user_code COLLATE pg_catalog."default" ASC NULLS LAST, approval_status COLLATE pg_catalog."default" ASC NULLS LAST, from_date ASC NULLS LAST)
    TABLESPACE pg_default
    WHERE approval_status::text = 'APPROVED'::text;