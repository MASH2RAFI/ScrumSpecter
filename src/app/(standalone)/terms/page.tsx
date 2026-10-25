import type { Metadata } from "next";

import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Terms of Service - ScrumSpecter" };

export default function TermsPage() {
    return (
        <LegalPage
            title="Terms of Service"
            sections={[
                {
                    heading: "Using ScrumSpecter",
                    body: "You may use ScrumSpecter to plan and track work with your team. Keep your account credentials safe and don't use the service for anything unlawful.",
                },
                {
                    heading: "Your content",
                    body: "You own the workspaces, projects and tasks you create. Workspace admins control who can see and change them.",
                },
                {
                    heading: "Availability",
                    body: "ScrumSpecter is provided as is. We aim to keep it running smoothly but can't guarantee it will always be available or error-free.",
                },
                {
                    heading: "Changes",
                    body: "These terms may be updated from time to time. Continuing to use ScrumSpecter means you accept the latest version.",
                },
            ]}
        />
    );
}
