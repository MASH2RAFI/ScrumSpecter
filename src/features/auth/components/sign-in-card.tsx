"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Form } from "@/components/ui/form";

import { loginSchema } from "../schemas";
import { useLogin } from "../api/use-login";
import { AuthCard, AuthInputField, AuthSubmitButton } from "./auth-card";

type FormValues = z.infer<typeof loginSchema>;

interface SignInCardProps {
    googleEnabled: boolean;
    error?: string;
}

export const SignInCard = ({ googleEnabled, error }: SignInCardProps) => {
    const { mutate, isPending } = useLogin();

    const form = useForm<FormValues>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            email: "",
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
            title="Welcome back!"
            description="Sign in to continue to your workspace"
        >
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <AuthInputField control={form.control} name="email" type="email" placeholder="Enter email address" />
                    <AuthInputField control={form.control} name="password" type="password" placeholder="Enter password" />
                    <AuthSubmitButton isPending={isPending} label="Sign In" pendingLabel="Signing in..." />
                </form>
            </Form>
        </AuthCard>
    );
};
