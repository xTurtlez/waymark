-- Milestone 3: inheritance tax tables are firm-only.
-- Families never see the IHT profile, gifts, earlier estates, or how a holding
-- or person is treated for tax. As everywhere, the app has no DELETE:
-- withdrawn entries are voided.
GRANT SELECT, INSERT, UPDATE ON iht_profile TO waymark_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON lifetime_gift TO waymark_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON prior_transfer TO waymark_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON holding_tax TO waymark_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON party_tax TO waymark_app;
--> statement-breakpoint
ALTER TABLE iht_profile ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY iht_profile_firm ON iht_profile FOR ALL TO waymark_app
  USING (firm_id = app_firm_id() AND app_scope() = 'firm')
  WITH CHECK (firm_id = app_firm_id() AND app_scope() = 'firm');
--> statement-breakpoint
ALTER TABLE lifetime_gift ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY lifetime_gift_firm ON lifetime_gift FOR ALL TO waymark_app
  USING (firm_id = app_firm_id() AND app_scope() = 'firm')
  WITH CHECK (firm_id = app_firm_id() AND app_scope() = 'firm');
--> statement-breakpoint
ALTER TABLE prior_transfer ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY prior_transfer_firm ON prior_transfer FOR ALL TO waymark_app
  USING (firm_id = app_firm_id() AND app_scope() = 'firm')
  WITH CHECK (firm_id = app_firm_id() AND app_scope() = 'firm');
--> statement-breakpoint
ALTER TABLE holding_tax ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY holding_tax_firm ON holding_tax FOR ALL TO waymark_app
  USING (firm_id = app_firm_id() AND app_scope() = 'firm')
  WITH CHECK (firm_id = app_firm_id() AND app_scope() = 'firm');
--> statement-breakpoint
ALTER TABLE party_tax ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY party_tax_firm ON party_tax FOR ALL TO waymark_app
  USING (firm_id = app_firm_id() AND app_scope() = 'firm')
  WITH CHECK (firm_id = app_firm_id() AND app_scope() = 'firm');
