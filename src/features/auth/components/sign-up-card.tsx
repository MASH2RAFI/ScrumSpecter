"use client";

import { z } from "zod";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle
} from "@/components/ui/card";

import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormMessage,
} from "@/components/ui/form";

import { registerSchema } from "../schemas";
import { Input } from "@/components/ui/input";
import { useRegister } from "../api/use-register";

export const SignUpCard = () => {
    const { mutate, isPending} = useRegister();

    const form = useForm<z.infer<typeof registerSchema>>({
            resolver: zodResolver(registerSchema),
            defaultValues: {
                name:"",
                email:"",
                password:""
            },
        });
    
        const onSubmit = (values: z.infer<typeof registerSchema>) => {
            mutate({ json: values });
        }
    

    return(
        <Card className="w-full max-w-md mx-auto border-0 shadow-2xl bg-gradient-to-br from-background to-muted/20 backdrop-blur-sm">
            <CardHeader className="flex flex-col items-center justify-center text-center p-8 pb-6">
                <div className="flex justify-center gap-1 mb-6 p-1 bg-muted/30 rounded-full">
                    <Button asChild variant="ghost" size="sm" className="rounded-full px-6 hover:bg-muted/50 transition-all duration-200">
                        <Link href="/sign-in">
                            Sign In
                        </Link>
                    </Button>
                    <Button asChild variant="primary" size="sm" className="rounded-full px-6 shadow-sm bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground">
                        <Link href="/sign-up">
                            Sign Up
                        </Link>
                    </Button>
                </div>
                <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                    Create Account
                </CardTitle>
                <p className="text-muted-foreground mt-2 text-sm">
                    Join thousands of teams using ScrumSpecter
                </p>
            </CardHeader>
            <CardContent className="p-8 pt-2">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

                        <FormField 
                            name="name"
                            control={form.control}
                            render={({ field })=> (
                                <FormItem>
                                    <FormControl>
                                        <Input
                                            {...field}
                                            type="text"
                                            placeholder="Enter your name"
                                            className="h-12 border-2 focus:border-primary/50 transition-colors duration-200"
                                        />  
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                        )}
                        />
                        <FormField 
                            name="email"
                            control={form.control}
                            render={({ field })=> (
                                <FormItem>
                                    <FormControl>
                                        <Input
                                            {...field}
                                            type="email"
                                            placeholder="Enter email address"
                                            className="h-12 border-2 focus:border-primary/50 transition-colors duration-200"
                                        />  
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                        )}
                        />
                        <FormField 
                            name="password"
                            control={form.control}
                            render={({ field })=> (
                                <FormItem>
                                    <FormControl>
                                        <Input
                                            {...field}
                                            type="password"
                                            placeholder="Enter password"
                                            className="h-12 border-2 focus:border-primary/50 transition-colors duration-200"
                                        />  
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button disabled={isPending} size="lg" className="w-full bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transition-all duration-200">
                            {isPending ? "Creating Account..." : "Create Account"}
                        </Button>
                    </form>
                </Form>
            </CardContent>
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
        </Card>
    );
};