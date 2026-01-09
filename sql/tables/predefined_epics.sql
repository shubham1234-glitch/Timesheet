-- Table: sts_ts.predefined_epics

-- DROP TABLE IF EXISTS sts_ts.predefined_epics;

CREATE TABLE IF NOT EXISTS sts_ts.predefined_epics
(
    id integer NOT NULL DEFAULT nextval('predefined_epics_id_seq'::regclass),
    title character varying(255) COLLATE pg_catalog."default" NOT NULL,
    description text COLLATE pg_catalog."default",
    contact_person_code character varying(10) COLLATE pg_catalog."default",
    priority_code integer NOT NULL,
    estimated_hours numeric(8,2) NOT NULL,
    estimated_days numeric(8,2) NOT NULL,
    is_billable boolean DEFAULT true,
    is_active boolean DEFAULT true,
    created_by character varying(30) COLLATE pg_catalog."default" NOT NULL,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_by character varying(30) COLLATE pg_catalog."default",
    updated_at timestamp without time zone,
    CONSTRAINT predefined_epics_pkey PRIMARY KEY (id),
    CONSTRAINT uq_predef_epic_title UNIQUE (title),
    CONSTRAINT fk_predef_epic_contact_person FOREIGN KEY (contact_person_code)
        REFERENCES sts_new.contact_master (contact_person_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_predef_epic_created_by FOREIGN KEY (created_by)
        REFERENCES sts_new.user_master (user_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_predef_epic_priority FOREIGN KEY (priority_code)
        REFERENCES sts_new.tkt_priority_master (priority_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_predef_epic_updated_by FOREIGN KEY (updated_by)
        REFERENCES sts_new.user_master (user_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS sts_ts.predefined_epics
    OWNER to sts_ts;

REVOKE ALL ON TABLE sts_ts.predefined_epics FROM sukraa_analyst;
REVOKE ALL ON TABLE sts_ts.predefined_epics FROM sukraa_dev;

GRANT ALL ON TABLE sts_ts.predefined_epics TO sts_ts;

GRANT SELECT ON TABLE sts_ts.predefined_epics TO sukraa_analyst;

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE sts_ts.predefined_epics TO sukraa_dev;
-- Index: idx_predef_epic_active

-- DROP INDEX IF EXISTS sts_ts.idx_predef_epic_active;

CREATE INDEX IF NOT EXISTS idx_predef_epic_active
    ON sts_ts.predefined_epics USING btree
    (is_active ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_predef_epic_contact_person_code

-- DROP INDEX IF EXISTS sts_ts.idx_predef_epic_contact_person_code;

CREATE INDEX IF NOT EXISTS idx_predef_epic_contact_person_code
    ON sts_ts.predefined_epics USING btree
    (contact_person_code COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;