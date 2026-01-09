-- Table: sts_ts.comments

-- DROP TABLE IF EXISTS sts_ts.comments;

CREATE TABLE IF NOT EXISTS sts_ts.comments
(
    id integer NOT NULL DEFAULT nextval('comments_id_seq'::regclass),
    parent_type character varying(20) COLLATE pg_catalog."default" NOT NULL,
    parent_code integer NOT NULL,
    comment_text text COLLATE pg_catalog."default" NOT NULL,
    commented_by character varying(30) COLLATE pg_catalog."default" NOT NULL DEFAULT CURRENT_USER,
    commented_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_by character varying(30) COLLATE pg_catalog."default",
    updated_at timestamp without time zone,
    CONSTRAINT comments_pkey PRIMARY KEY (id),
    CONSTRAINT fk_comments_commented_by FOREIGN KEY (commented_by)
        REFERENCES sts_new.user_master (user_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_comments_updated_by FOREIGN KEY (updated_by)
        REFERENCES sts_new.user_master (user_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT chk_comments_parent_type CHECK (parent_type::text = ANY (ARRAY['TASK'::character varying, 'SUBTASK'::character varying, 'EPIC'::character varying, 'TIMESHEET_ENTRY'::character varying]::text[]))
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS sts_ts.comments
    OWNER to sts_ts;

REVOKE ALL ON TABLE sts_ts.comments FROM sukraa_analyst;
REVOKE ALL ON TABLE sts_ts.comments FROM sukraa_dev;

GRANT ALL ON TABLE sts_ts.comments TO sts_ts;

GRANT SELECT ON TABLE sts_ts.comments TO sukraa_analyst;

GRANT DELETE, INSERT, UPDATE, SELECT ON TABLE sts_ts.comments TO sukraa_dev;
-- Index: idx_comments_commented_at

-- DROP INDEX IF EXISTS sts_ts.idx_comments_commented_at;

CREATE INDEX IF NOT EXISTS idx_comments_commented_at
    ON sts_ts.comments USING btree
    (commented_at DESC NULLS FIRST)
    TABLESPACE pg_default;
-- Index: idx_comments_commented_by

-- DROP INDEX IF EXISTS sts_ts.idx_comments_commented_by;

CREATE INDEX IF NOT EXISTS idx_comments_commented_by
    ON sts_ts.comments USING btree
    (commented_by COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_comments_parent_commented_at

-- DROP INDEX IF EXISTS sts_ts.idx_comments_parent_commented_at;

CREATE INDEX IF NOT EXISTS idx_comments_parent_commented_at
    ON sts_ts.comments USING btree
    (parent_type COLLATE pg_catalog."default" ASC NULLS LAST, parent_code ASC NULLS LAST, commented_at DESC NULLS FIRST)
    TABLESPACE pg_default;
-- Index: idx_comments_parent_type_code

-- DROP INDEX IF EXISTS sts_ts.idx_comments_parent_type_code;

CREATE INDEX IF NOT EXISTS idx_comments_parent_type_code
    ON sts_ts.comments USING btree
    (parent_type COLLATE pg_catalog."default" ASC NULLS LAST, parent_code ASC NULLS LAST)
    TABLESPACE pg_default;