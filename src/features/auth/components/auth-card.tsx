"use client";

import Link from "next/link";
import { Control, FieldPath, FieldValues } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    FormControl,
    FormField,
    FormItem,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const ACTIVE_TAB_CLASS_NAME = "rounded-full px-6 shadow-sm bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground";
const INACTIVE_TAB_CLASS_NAME = "rounded-full px-6 hover:bg-muted/50 transition-all duration-200";

const TABS = [
    { href: "/sign-in", label: "Sign In" },
    { href: "/sign-up", label: "Sign Up" },
] as const;

const GOOGLE_ERRORS: Record<string, string> = {
    google_cancelled: "Google sign-in was cancelled.",
    google_unverified: "Your Google account's email isn't verified.",
    google_unavailable: "Google sign-in isn't available right now.",
    google_failed: "Google sign-in failed. Please try again.",
};

interface AuthCardProps {
    active: (typeof TABS)[number]["href"];
    title: string;
    description: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    googleEnabled?: boolean;
    error?: string;
}

const GoogleIcon = () => (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.94l3.66-2.84z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
);

// Google first, then the email form below a divider
const GoogleSignIn = () => (
    <div className="space-y-4 mb-4">
        <Button asChild variant="outline" size="lg" className="w-full h-12 gap-3 border-2">
            {/* A full navigation, not client routing: the API redirects to Google */}
            <a href="/api/auth/google">
                <GoogleIcon />
                Continue with Google
            </a>
        </Button>
        <div className="flex items-center gap-3 text-xs uppercase text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or continue with email
            <span className="h-px flex-1 bg-border" />
        </div>
    </div>
);

export const AuthCard = ({ active, title, description, children, footer, googleEnabled, error }: AuthCardProps) => (
    <Card className="w-full max-w-md mx-auto border-0 shadow-2xl bg-gradient-to-br from-background to-muted/20 backdrop-blur-sm">
        <CardHeader className="flex flex-col items-center justify-center text-center p-8 pb-6">
            <div className="flex justify-center gap-1 mb-6 p-1 bg-muted/30 rounded-full">
                {TABS.map(({ href, label }) => (
                    <Button
                        key={href}
                        asChild
                        variant={href === active ? "primary" : "ghost"}
                        size="sm"
                        className={href === active ? ACTIVE_TAB_CLASS_NAME : INACTIVE_TAB_CLASS_NAME}
                    >
                        <Link href={href}>
                            {label}
                        </Link>
                    </Button>
                ))}
            </div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                {title}
            </CardTitle>
            <p className="text-muted-foreground mt-2 text-sm">
                {description}
            </p>
        </CardHeader>
        <CardContent className="p-8 pt-2">
            {error && GOOGLE_ERRORS[error] && (
                <p role="alert" className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {GOOGLE_ERRORS[error]}
                </p>
            )}
            {googleEnabled && <GoogleSignIn />}
            {children}
        </CardContent>
        {footer}
    </Card>
);

interface AuthInputFieldProps<T extends FieldValues> {
    control: Control<T>;
    name: FieldPath<T>;
    type: "text" | "email" | "password";
    placeholder: string;
}

export const AuthInputField = <T extends FieldValues>({ control, name, type, placeholder }: AuthInputFieldProps<T>) => (
    <FormField
        name={name}
        control={control}
        render={({ field }) => (
            <FormItem>
                <FormControl>
                    <Input
                        {...field}
                        type={type}
                        placeholder={placeholder}
                        className="h-12 border-2 focus:border-primary/50 transition-colors duration-200"
                    />
                </FormControl>
                <FormMessage />
            </FormItem>
        )}
    />
);

interface AuthSubmitButtonProps {
    isPending: boolean;
    label: string;
    pendingLabel: string;
}

export const AuthSubmitButton = ({ isPending, label, pendingLabel }: AuthSubmitButtonProps) => (
    <Button disabled={isPending} size="lg" className="w-full bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transition-all duration-200">
        {isPending ? pendingLabel : label}
    </Button>
);
