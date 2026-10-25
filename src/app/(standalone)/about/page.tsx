import { AboutContent } from "@/components/about-content";
import { getCurrent } from "@/features/auth/queries";
import { redirectHome } from "@/features/workspaces/redirect-home";

export default async function AboutPage() {
    // Signed-in users go to their workspace; getCurrent skips the DB when there's no cookie
    const user = await getCurrent();
    if (user) return redirectHome(user.$id);

    return <AboutContent />;
}
