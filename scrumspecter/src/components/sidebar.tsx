import Image from "next/image";
import Link from "next/link";
import { DottedSeparator } from "./dotted-separator";
import { Navigation } from "./navigation";
import { WorkspaceSwitcher } from "./workspace-switcher";

export const Sidebar = () => {
    return(
        <aside className="h-full bg-neutral-100 p-4 w-full">
            <Link href="/">
                <Image src="/logo.svg" alt="logo" width={100} height={50} />
            </Link>
            <DottedSeparator className="my-4" />
            <WorkspaceSwitcher />
            <DottedSeparator className="my-4" />
            <Navigation />
        </aside>
    );
};