"use client";

import { z } from "zod";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Form } from "@/components/ui/form";

import { registerSchema } from "../schemas";
import { useRegister } from "../api/use-register";
import { AuthCard, AuthInputField, AuthSubmitButton } from "./auth-card";

type FormValues = z.infer<typeof registerSchema>;

interface SignUpCardProps {
    googleEnabled: boolean;
    error?: string;
}

export const SignUpCard = ({ googleEnabled, error }: SignUpCardProps) => {
    const { mutate, isPending } = useRegister();

    const form = useForm<FormValues>({
        resolver: zodResolver(registerSchema),
        defaultValues: {
            name: "",
            email: "",
            password: "",
        },
    });

    const onSubmit = (values: FormValues) => {
        mutate({ json: values });
    };

    return (
        <AuthCard
            active="/sign-up"
            googleEnabled={googleEnabled}
            error={error}
            title="Create Account"
            description="Join thousands of teams using ScrumSpecter"
            footer={
                <div className="px-8 pb-8">
                    <p className="text-xs text-muted-foreground text-center">
                        By signing up, you agree to our{" "}
                        <Link href="/privacy" className="text-primary hover:underline">
                            Privacy Policy
                        </Link>{" "}and{" "}
                        <Link href="/terms" className="text-primary hover:underline">
                            Terms of Service
                        </Link>
                    </p>
                </div>
            }
        >
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <AuthInputField control={form.control} name="name" type="text" placeholder="Enter your name" />
                    <AuthInputField control={form.control} name="email" type="email" placeholder="Enter email address" />
                    <AuthInputField control={form.control} name="password" type="password" placeholder="Enter password" />
                    <AuthSubmitButton isPending={isPending} label="Create Account" pendingLabel="Creating Account..." />
                </form>
            </Form>
        </AuthCard>
    );
};
