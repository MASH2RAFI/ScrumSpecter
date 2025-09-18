import Link from "next/link";
import { DottedSeparator } from "./dotted-separator";
import { Navigation } from "./navigation";
import { WorkspaceSwitcher } from "./workspace-switcher";
import { Projects } from "./projects";
import { ThemeLogo } from "./theme-logo";

export const Sidebar = () => {
    return(
        <aside className="h-full bg-background p-4 sm:p-6 w-full transition-unified">
            <Link href="/" className="block mb-6">
                <ThemeLogo width={100} height={50} />
            </Link>
            <DottedSeparator className="my-4" />
            <div className="space-y-6">
                <WorkspaceSwitcher />
                <DottedSeparator className="my-4" />
                <Navigation />
                <DottedSeparator className="my-4" />
                <Projects />
            </div>
        </aside>
    );
};