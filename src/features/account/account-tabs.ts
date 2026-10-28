export const ACCOUNT_TABS = ["profile", "security", "preferences"] as const;
export type AccountTab = (typeof ACCOUNT_TABS)[number];

// The account page; ?tab= picks the section (the Google link flow returns to "security")
export const accountHref = (tab?: AccountTab) => (tab && tab !== "profile" ? `/account?tab=${tab}` : "/account");
