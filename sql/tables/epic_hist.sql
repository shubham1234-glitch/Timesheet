-- Table: sts_ts.epic_hist

-- DROP TABLE IF EXISTS sts_ts.epic_hist;

CREATE TABLE IF NOT EXISTS sts_ts.epic_hist
(
    id integer NOT NULL DEFAULT nextval('epic_hist_id_seq'::regclass),
    epic_code integer NOT NULL,
    status_code character varying(30) COLLATE pg_catalog."default" NOT NULL,
    status_reason text COLLATE pg_catalog."default",
    user_code character varying(30) COLLATE pg_catalog."default",
    reporter character varying(30) COLLATE pg_catalog."default",
    priority_code integer,
    product_code character varying(10) COLLATE pg_catalog."default",
    start_date date,
    due_date date,
    closed_on date,
    estimated_hours numeric(6,2),
    estimated_days numeric(6,2),
    cancelled_by character varying(30) COLLATE pg_catalog."default",
    cancelled_at date,
    created_by character varying(30) COLLATE pg_catalog."default" NOT NULL,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    CONSTRAINT epic_hist_pkey PRIMARY KEY (id),
    CONSTRAINT fk_epic_hist_created_by FOREIGN KEY (created_by)
        REFERENCES sts_new.user_master (user_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_epic_hist_epic_code FOREIGN KEY (epic_code)
        REFERENCES sts_ts.epics (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_epic_hist_priority_code FOREIGN KEY (priority_code)
        REFERENCES sts_new.tkt_priority_master (priority_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_epic_hist_product_code FOREIGN KEY (product_code)
        REFERENCES sts_new.product_master (product_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_epic_hist_reporter FOREIGN KEY (reporter)
        REFERENCES sts_new.user_master (user_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_epic_hist_status_code FOREIGN KEY (status_code)
        REFERENCES sts_new.status_master (status_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_epic_hist_user_code FOREIGN KEY (user_code)
        REFERENCES sts_new.user_master (user_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT chk_epic_hist_status_code CHECK (status_code::text = ANY (ARRAY['STS001'::character varying, 'STS007'::character varying, 'STS002'::character varying, 'STS010'::character varying]::text[]))
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS sts_ts.epic_hist
    OWNER to sts_ts;

REVOKE ALL ON TABLE sts_ts.epic_hist FROM sukraa_analyst;
REVOKE ALL ON TABLE sts_ts.epic_hist FROM sukraa_dev;

GRANT ALL ON TABLE sts_ts.epic_hist TO sts_ts;

GRANT SELECT ON TABLE sts_ts.epic_hist TO sukraa_analyst;

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE sts_ts.epic_hist TO sukraa_dev;
-- Index: idx_epic_hist_created_at

-- DROP INDEX IF EXISTS sts_ts.idx_epic_hist_created_at;

CREATE INDEX IF NOT EXISTS idx_epic_hist_created_at
    ON sts_ts.epic_hist USING btree
    (created_at DESC NULLS FIRST)
    TABLESPACE pg_default;
-- Index: idx_epic_hist_epic_code

-- DROP INDEX IF EXISTS sts_ts.idx_epic_hist_epic_code;

CREATE INDEX IF NOT EXISTS idx_epic_hist_epic_code
    ON sts_ts.epic_hist USING btree
    (epic_code ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_epic_hist_epic_code_created_at_id

-- DROP INDEX IF EXISTS sts_ts.idx_epic_hist_epic_code_created_at_id;

CREATE INDEX IF NOT EXISTS idx_epic_hist_epic_code_created_at_id
    ON sts_ts.epic_hist USING btree
    (epic_code ASC NULLS LAST, created_at DESC NULLS FIRST, id DESC NULLS FIRST)
    TABLESPACE pg_default;
-- Index: idx_epic_hist_product_code

-- DROP INDEX IF EXISTS sts_ts.idx_epic_hist_product_code;

CREATE INDEX IF NOT EXISTS idx_epic_hist_product_code
    ON sts_ts.epic_hist USING btree
    (product_code COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_epic_hist_product_created

-- DROP INDEX IF EXISTS sts_ts.idx_epic_hist_product_created;

CREATE INDEX IF NOT EXISTS idx_epic_hist_product_created
    ON sts_ts.epic_hist USING btree
    (product_code COLLATE pg_catalog."default" ASC NULLS LAST, created_at DESC NULLS FIRST)
    TABLESPACE pg_default
    WHERE product_code IS NOT NULL;
-- Index: idx_epic_hist_reporter

-- DROP INDEX IF EXISTS sts_ts.idx_epic_hist_reporter;

CREATE INDEX IF NOT EXISTS idx_epic_hist_reporter
    ON sts_ts.epic_hist USING btree
    (reporter COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_epic_hist_status_code

-- DROP INDEX IF EXISTS sts_ts.idx_epic_hist_status_code;

CREATE INDEX IF NOT EXISTS idx_epic_hist_status_code
    ON sts_ts.epic_hist USING btree
    (status_code COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_epic_hist_status_created

-- DROP INDEX IF EXISTS sts_ts.idx_epic_hist_status_created;

CREATE INDEX IF NOT EXISTS idx_epic_hist_status_created
    ON sts_ts.epic_hist USING btree
    (status_code COLLATE pg_catalog."default" ASC NULLS LAST, created_at DESC NULLS FIRST)
    TABLESPACE pg_default;
-- Index: idx_epic_hist_user_code

-- DROP INDEX IF EXISTS sts_ts.idx_epic_hist_user_code;

CREATE INDEX IF NOT EXISTS idx_epic_hist_user_code
    ON sts_ts.epic_hist USING btree
    (user_code COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;