import Link from "next/link";

interface LegalPageProps {
    title: string;
    sections: { heading: string; body: string }[];
}

// Placeholder legal copy; replace the section text before relying on it
export const LegalPage = ({ title, sections }: LegalPageProps) => (
    <article className="mx-auto w-full max-w-3xl py-8 space-y-8">
        <header className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground">{title}</h1>
            <p className="text-sm text-muted-foreground">
                This page is a placeholder and will be updated soon.
            </p>
        </header>
        {sections.map(({ heading, body }) => (
            <section key={heading} className="space-y-2">
                <h2 className="text-lg font-semibold text-foreground">{heading}</h2>
                <p className="text-muted-foreground leading-relaxed">{body}</p>
            </section>
        ))}
        <footer className="pt-4 border-t border-border text-sm text-muted-foreground">
            Back to <Link href="/about" className="text-primary hover:underline">ScrumSpecter</Link>
        </footer>
    </article>
);
