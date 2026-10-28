"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import Link from "next/link";

import { Form } from "@/components/ui/form";

import { loginSchema } from "../schemas";
import { useLogin } from "../api/use-login";
import { AuthCard, AuthInputField, AuthSubmitButton } from "./auth-card";

type FormValues = z.infer<typeof loginSchema>;

interface SignInCardProps {
    googleEnabled: boolean;
    error?: string;
    next?: string | null;
    // A Google sign-in for this email waits for the account's password (see /api/auth/google/callback)
    linkGoogleEmail?: string;
}

export const SignInCard = ({ googleEnabled, error, next, linkGoogleEmail }: SignInCardProps) => {
    const { mutate, isPending } = useLogin(next);

    const form = useForm<FormValues>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            email: linkGoogleEmail ?? "",
            password: "",
        },
    });

    const onSubmit = (values: FormValues) => {
        mutate({ json: values });
    };

    return (
        <AuthCard
            active="/sign-in"
            googleEnabled={googleEnabled}
            error={error}
            next={next}
            notice={linkGoogleEmail
                ? "An account with this email already exists. Sign in with its password once to link your Google account."
                : next?.includes("/join/") ? "Sign in to accept the workspace invite." : undefined}
            title="Welcome back!"
            description="Sign in to continue to your workspace"
        >
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <AuthInputField control={form.control} name="email" type="email" placeholder="Enter email address" />
                    <AuthInputField control={form.control} name="password" type="password" placeholder="Enter password" />
                    <AuthSubmitButton isPending={isPending} label="Sign In" pendingLabel="Signing in..." />
                    <p className="text-center text-sm">
                        <Link href="/forgot-password" className="text-primary hover:underline">Forgot password?</Link>
                    </p>
                </form>
            </Form>
        </AuthCard>
    );
};
