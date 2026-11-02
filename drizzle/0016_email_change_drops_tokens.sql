-- Changing a user's email must also retire their unused verification links: otherwise a link
-- mailed to the old address would mark the new, unproven address as verified (audit finding #1)
CREATE OR REPLACE FUNCTION unverify_changed_email() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	NEW.email_verified_at := NULL;
	DELETE FROM email_verifications WHERE user_id = NEW.id AND used_at IS NULL;
	RETURN NEW;
END $$;
