import Link from "next/link";
import { SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";

const NotFound = () => {
    return (
        <div className="h-screen flex flex-col gap-y-4 items-center justify-center">
            <SearchX className="size-10 text-muted-foreground" />
            <h1 className="text-lg font-semibold">Page not found</h1>
            <p className="text-sm text-muted-foreground">
                The page you&apos;re looking for doesn&apos;t exist or has moved.
            </p>
            <Button variant="secondary" size="sm" asChild>
                <Link href="/">Back to home</Link>
            </Button>
        </div>
    );
};

export default NotFound;
