import Link from "next/link";
import { DottedSeparator } from "./dotted-separator";
import { Navigation } from "./navigation";
import { WorkspaceSwitcher } from "./workspace-switcher";
import { Projects } from "./projects";
import { ThemeLogo } from "./theme-logo";

export const Sidebar = () => {
    return(
        <aside className="h-full bg-background p-4 w-full">
            <Link href="/">
                <ThemeLogo width={100} height={50} />
            </Link>
            <DottedSeparator className="my-4" />
            <WorkspaceSwitcher />
            <DottedSeparator className="my-4" />
            <Navigation />
            <DottedSeparator className="my-4" />
            <Projects />
        </aside>
    );
};