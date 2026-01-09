-- Table: sts_ts.epics

-- DROP TABLE IF EXISTS sts_ts.epics;

CREATE TABLE IF NOT EXISTS sts_ts.epics
(
    id integer NOT NULL DEFAULT nextval('epics_id_seq'::regclass),
    epic_title character varying(255) COLLATE pg_catalog."default" NOT NULL,
    epic_description text COLLATE pg_catalog."default",
    product_code character varying(10) COLLATE pg_catalog."default" NOT NULL,
    company_code character varying(10) COLLATE pg_catalog."default",
    contact_person_code character varying(10) COLLATE pg_catalog."default",
    reporter character varying(30) COLLATE pg_catalog."default",
    predefined_epic_id integer,
    status_code character varying(30) COLLATE pg_catalog."default" NOT NULL DEFAULT 'STS001'::character varying,
    priority_code integer NOT NULL,
    start_date date NOT NULL,
    due_date date NOT NULL,
    closed_on date,
    estimated_hours numeric(8,2) NOT NULL,
    estimated_days numeric(8,2) NOT NULL,
    is_billable boolean DEFAULT true,
    cancelled_by character varying(30) COLLATE pg_catalog."default",
    cancelled_at date,
    cancellation_reason text COLLATE pg_catalog."default",
    created_by character varying(30) COLLATE pg_catalog."default" NOT NULL,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_by character varying(30) COLLATE pg_catalog."default",
    updated_at timestamp without time zone,
    CONSTRAINT epics_pkey PRIMARY KEY (id),
    CONSTRAINT fk_epic_cancelled_by FOREIGN KEY (cancelled_by)
        REFERENCES sts_new.user_master (user_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_epic_company FOREIGN KEY (company_code)
        REFERENCES sts_new.company_master (company_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_epic_contact_person FOREIGN KEY (contact_person_code)
        REFERENCES sts_new.contact_master (contact_person_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_epic_created_by FOREIGN KEY (created_by)
        REFERENCES sts_new.user_master (user_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_epic_predefined_epic FOREIGN KEY (predefined_epic_id)
        REFERENCES sts_ts.predefined_epics (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_epic_priority FOREIGN KEY (priority_code)
        REFERENCES sts_new.tkt_priority_master (priority_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_epic_product FOREIGN KEY (product_code)
        REFERENCES sts_new.product_master (product_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_epic_reporter FOREIGN KEY (reporter)
        REFERENCES sts_new.user_master (user_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_epic_status FOREIGN KEY (status_code)
        REFERENCES sts_new.status_master (status_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_epic_updated_by FOREIGN KEY (updated_by)
        REFERENCES sts_new.user_master (user_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT chk_epic_status_code CHECK (status_code::text = ANY (ARRAY['STS001'::character varying, 'STS007'::character varying, 'STS002'::character varying, 'STS010'::character varying]::text[]))
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS sts_ts.epics
    OWNER to sts_ts;

REVOKE ALL ON TABLE sts_ts.epics FROM sukraa_analyst;
REVOKE ALL ON TABLE sts_ts.epics FROM sukraa_dev;

GRANT ALL ON TABLE sts_ts.epics TO sts_ts;

GRANT SELECT ON TABLE sts_ts.epics TO sukraa_analyst;

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE sts_ts.epics TO sukraa_dev;
-- Index: idx_epics_company_code

-- DROP INDEX IF EXISTS sts_ts.idx_epics_company_code;

CREATE INDEX IF NOT EXISTS idx_epics_company_code
    ON sts_ts.epics USING btree
    (company_code COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_epics_contact_person_code

-- DROP INDEX IF EXISTS sts_ts.idx_epics_contact_person_code;

CREATE INDEX IF NOT EXISTS idx_epics_contact_person_code
    ON sts_ts.epics USING btree
    (contact_person_code COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_epics_id

-- DROP INDEX IF EXISTS sts_ts.idx_epics_id;

CREATE INDEX IF NOT EXISTS idx_epics_id
    ON sts_ts.epics USING btree
    (id ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_epics_predefined_epic_id

-- DROP INDEX IF EXISTS sts_ts.idx_epics_predefined_epic_id;

CREATE INDEX IF NOT EXISTS idx_epics_predefined_epic_id
    ON sts_ts.epics USING btree
    (predefined_epic_id ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_epics_priority

-- DROP INDEX IF EXISTS sts_ts.idx_epics_priority;

CREATE INDEX IF NOT EXISTS idx_epics_priority
    ON sts_ts.epics USING btree
    (priority_code ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_epics_product_code

-- DROP INDEX IF EXISTS sts_ts.idx_epics_product_code;

CREATE INDEX IF NOT EXISTS idx_epics_product_code
    ON sts_ts.epics USING btree
    (product_code COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_epics_reporter

-- DROP INDEX IF EXISTS sts_ts.idx_epics_reporter;

CREATE INDEX IF NOT EXISTS idx_epics_reporter
    ON sts_ts.epics USING btree
    (reporter COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_epics_status_code

-- DROP INDEX IF EXISTS sts_ts.idx_epics_status_code;

CREATE INDEX IF NOT EXISTS idx_epics_status_code
    ON sts_ts.epics USING btree
    (status_code COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;