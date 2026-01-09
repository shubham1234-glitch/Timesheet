-- Table: sts_ts.activities

-- DROP TABLE IF EXISTS sts_ts.activities;

CREATE TABLE IF NOT EXISTS sts_ts.activities
(
    id integer NOT NULL DEFAULT nextval('activities_id_seq'::regclass),
    activity_title character varying(255) COLLATE pg_catalog."default" NOT NULL,
    activity_description text COLLATE pg_catalog."default",
    product_code character varying(10) COLLATE pg_catalog."default" NOT NULL,
    is_billable boolean DEFAULT true,
    created_by character varying(30) COLLATE pg_catalog."default" NOT NULL,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_by character varying(30) COLLATE pg_catalog."default",
    updated_at timestamp without time zone,
    CONSTRAINT activities_pkey PRIMARY KEY (id),
    CONSTRAINT fk_activities_created_by FOREIGN KEY (created_by)
        REFERENCES sts_new.user_master (user_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_activities_product_code FOREIGN KEY (product_code)
        REFERENCES sts_new.product_master (product_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_activities_updated_by FOREIGN KEY (updated_by)
        REFERENCES sts_new.user_master (user_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS sts_ts.activities
    OWNER to sts_ts;

REVOKE ALL ON TABLE sts_ts.activities FROM sukraa_analyst;
REVOKE ALL ON TABLE sts_ts.activities FROM sukraa_dev;

GRANT ALL ON TABLE sts_ts.activities TO sts_ts;

GRANT SELECT ON TABLE sts_ts.activities TO sukraa_analyst;

GRANT DELETE, INSERT, UPDATE, SELECT ON TABLE sts_ts.activities TO sukraa_dev;
-- Index: idx_activities_created_at

-- DROP INDEX IF EXISTS sts_ts.idx_activities_created_at;

CREATE INDEX IF NOT EXISTS idx_activities_created_at
    ON sts_ts.activities USING btree
    (created_at DESC NULLS FIRST)
    TABLESPACE pg_default;
-- Index: idx_activities_created_by

-- DROP INDEX IF EXISTS sts_ts.idx_activities_created_by;

CREATE INDEX IF NOT EXISTS idx_activities_created_by
    ON sts_ts.activities USING btree
    (created_by COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_activities_is_billable

-- DROP INDEX IF EXISTS sts_ts.idx_activities_is_billable;

CREATE INDEX IF NOT EXISTS idx_activities_is_billable
    ON sts_ts.activities USING btree
    (is_billable ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_activities_product_code

-- DROP INDEX IF EXISTS sts_ts.idx_activities_product_code;

CREATE INDEX IF NOT EXISTS idx_activities_product_code
    ON sts_ts.activities USING btree
    (product_code COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;