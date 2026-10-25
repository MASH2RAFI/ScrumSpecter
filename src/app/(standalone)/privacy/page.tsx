import type { Metadata } from "next";

import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Privacy Policy - ScrumSpecter" };

export default function PrivacyPage() {
    return (
        <LegalPage
            title="Privacy Policy"
            sections={[
                {
                    heading: "What we collect",
                    body: "Your name, email address and the workspaces, projects and tasks you create. Passwords are stored only as secure hashes.",
                },
                {
                    heading: "How we use it",
                    body: "Only to run ScrumSpecter for you and the people you share workspaces with. We do not sell your data or use it for advertising.",
                },
                {
                    heading: "Cookies",
                    body: "We use a single session cookie to keep you signed in. Your theme and personal todos are stored in your browser.",
                },
                {
                    heading: "Contact",
                    body: "Questions about your data? Reach out to the ScrumSpecter team.",
                },
            ]}
        />
    );
}
