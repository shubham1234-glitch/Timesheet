-- View: sts_ts.view_login

-- DROP VIEW sts_ts.view_login;

CREATE OR REPLACE VIEW sts_ts.view_login
 AS
 SELECT um.user_code,
    um.user_name,
    um.password,
    um.user_type_code,
    um.user_type_description,
    um.designation_name,
    um.team,
    um.team_code,
    tm.team_name,
    tm.department AS team_department,
    tm.team_lead,
    tm.reporter,
    um.company_code,
    um.contact_num,
    um.email_id
   FROM sts_new.user_master um
     LEFT JOIN sts_new.team_master tm ON um.team_code::text = tm.team_code::text
  WHERE um.is_inactive = false AND (um.user_type_code::text <> ALL (ARRAY['C'::character varying::text, 'CLIENT'::character varying::text]));

ALTER TABLE sts_ts.view_login
    OWNER TO sts_ts;

GRANT ALL ON TABLE sts_ts.view_login TO sts_ts;
GRANT SELECT ON TABLE sts_ts.view_login TO sukraa_analyst;
GRANT SELECT ON TABLE sts_ts.view_login TO sukraa_dev;

