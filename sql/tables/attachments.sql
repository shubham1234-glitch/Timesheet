-- Table: sts_ts.attachments

-- DROP TABLE IF EXISTS sts_ts.attachments;

CREATE TABLE IF NOT EXISTS sts_ts.attachments
(
    id integer NOT NULL DEFAULT nextval('attachments_id_seq'::regclass),
    parent_type character varying(20) COLLATE pg_catalog."default" NOT NULL,
    parent_code integer NOT NULL,
    file_path text COLLATE pg_catalog."default",
    file_url text COLLATE pg_catalog."default",
    file_name character varying(255) COLLATE pg_catalog."default",
    file_type character varying(50) COLLATE pg_catalog."default",
    file_size text COLLATE pg_catalog."default" NOT NULL,
    purpose text COLLATE pg_catalog."default",
    created_by character varying(50) COLLATE pg_catalog."default" NOT NULL,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_by character varying(50) COLLATE pg_catalog."default",
    updated_at timestamp without time zone,
    CONSTRAINT attachments_pkey PRIMARY KEY (id),
    CONSTRAINT fk_attachments_created_by FOREIGN KEY (created_by)
        REFERENCES sts_new.user_master (user_code) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT chk_attachments_parent_type CHECK (parent_type::text = ANY (ARRAY['TASK'::character varying, 'EPIC'::character varying, 'TIMESHEET_ENTRY'::character varying, 'LEAVE_APPLICATION'::character varying, 'ACTIVITY'::character varying, 'SUBTASK'::character varying]::text[])),
    CONSTRAINT chk_attachments_file_type CHECK (file_type IS NULL OR (file_type::text = ANY (ARRAY['pdf'::character varying, 'doc'::character varying, 'docx'::character varying, 'xls'::character varying, 'xlsx'::character varying, 'ppt'::character varying, 'pptx'::character varying, 'txt'::character varying, 'csv'::character varying, 'jpg'::character varying, 'jpeg'::character varying, 'png'::character varying, 'gif'::character varying, 'bmp'::character varying, 'svg'::character varying, 'tiff'::character varying, 'mp4'::character varying, 'avi'::character varying, 'mov'::character varying, 'wmv'::character varying, 'flv'::character varying, 'mp3'::character varying, 'wav'::character varying, 'flac'::character varying, 'aac'::character varying, 'zip'::character varying, 'rar'::character varying, '7z'::character varying, 'tar'::character varying, 'gz'::character varying, 'json'::character varying, 'xml'::character varying, 'html'::character varying, 'css'::character varying, 'js'::character varying, 'sql'::character varying]::text[])))
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS sts_ts.attachments
    OWNER to sts_ts;

REVOKE ALL ON TABLE sts_ts.attachments FROM sukraa_analyst;
REVOKE ALL ON TABLE sts_ts.attachments FROM sukraa_dev;

GRANT ALL ON TABLE sts_ts.attachments TO sts_ts;

GRANT SELECT ON TABLE sts_ts.attachments TO sukraa_analyst;

GRANT DELETE, INSERT, UPDATE, SELECT ON TABLE sts_ts.attachments TO sukraa_dev;
-- Index: idx_attachments_created_at

-- DROP INDEX IF EXISTS sts_ts.idx_attachments_created_at;

CREATE INDEX IF NOT EXISTS idx_attachments_created_at
    ON sts_ts.attachments USING btree
    (created_at DESC NULLS FIRST)
    TABLESPACE pg_default;
-- Index: idx_attachments_created_by

-- DROP INDEX IF EXISTS sts_ts.idx_attachments_created_by;

CREATE INDEX IF NOT EXISTS idx_attachments_created_by
    ON sts_ts.attachments USING btree
    (created_by COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_attachments_parent_code

-- DROP INDEX IF EXISTS sts_ts.idx_attachments_parent_code;

CREATE INDEX IF NOT EXISTS idx_attachments_parent_code
    ON sts_ts.attachments USING btree
    (parent_code ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_attachments_parent_created_at

-- DROP INDEX IF EXISTS sts_ts.idx_attachments_parent_created_at;

CREATE INDEX IF NOT EXISTS idx_attachments_parent_created_at
    ON sts_ts.attachments USING btree
    (parent_type COLLATE pg_catalog."default" ASC NULLS LAST, parent_code ASC NULLS LAST, created_at DESC NULLS FIRST)
    TABLESPACE pg_default;
-- Index: idx_attachments_parent_type

-- DROP INDEX IF EXISTS sts_ts.idx_attachments_parent_type;

CREATE INDEX IF NOT EXISTS idx_attachments_parent_type
    ON sts_ts.attachments USING btree
    (parent_type COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_attachments_parent_type_code

-- DROP INDEX IF EXISTS sts_ts.idx_attachments_parent_type_code;

CREATE INDEX IF NOT EXISTS idx_attachments_parent_type_code
    ON sts_ts.attachments USING btree
    (parent_type COLLATE pg_catalog."default" ASC NULLS LAST, parent_code ASC NULLS LAST)
    TABLESPACE pg_default;