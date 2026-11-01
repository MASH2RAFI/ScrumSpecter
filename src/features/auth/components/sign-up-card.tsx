"use client";

import { z } from "zod";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Form } from "@/components/ui/form";

import { registerSchema } from "../schemas";
import { useRegister } from "../api/use-register";
import { AuthCard, AuthInputField, AuthSubmitButton } from "./auth-card";
import { MAX_EMAIL, MAX_PASSWORD, MAX_PERSON_NAME } from "@/lib/limits";

type FormValues = z.infer<typeof registerSchema>;

interface SignUpCardProps {
    googleEnabled: boolean;
    error?: string;
    next?: string | null;
}

export const SignUpCard = ({ googleEnabled, error, next }: SignUpCardProps) => {
    const { mutate, isPending } = useRegister(next);

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
            next={next}
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
                    <AuthInputField control={form.control} name="name" type="text" placeholder="Enter your name" maxLength={MAX_PERSON_NAME} />
                    <AuthInputField control={form.control} name="email" type="email" placeholder="Enter email address" maxLength={MAX_EMAIL} />
                    <AuthInputField control={form.control} name="password" type="password" placeholder="Enter password" maxLength={MAX_PASSWORD} />
                    <AuthSubmitButton isPending={isPending} label="Create Account" pendingLabel="Creating Account..." />
                </form>
            </Form>
        </AuthCard>
    );
};
