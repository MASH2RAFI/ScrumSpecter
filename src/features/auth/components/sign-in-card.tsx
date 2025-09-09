"use client";

import { z } from "zod";
import { FcGoogle } from "react-icons/fc";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";

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

import { Input } from "@/components/ui/input";
import { loginSchema } from "../schemas";
import { useLogin } from "../api/use-login";

export const SignInCard = () => {
    const { mutate, isPending } = useLogin();

    const form = useForm<z.infer<typeof loginSchema>>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            email:"",
            password:""
        },
    });

    const onSubmit = (values: z.infer<typeof loginSchema>) => {
       mutate({json: values});
    }



    return(
        <Card className="w-full max-w-md mx-auto border-0 shadow-2xl bg-gradient-to-br from-background to-muted/20 backdrop-blur-sm">
            <CardHeader className="flex flex-col items-center justify-center text-center p-8 pb-6">
                <div className="flex justify-center gap-1 mb-6 p-1 bg-muted/30 rounded-full">
                    <Button asChild variant="primary" size="sm" className="rounded-full px-6 shadow-sm bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground">
                        <Link href="/sign-in">
                            Sign In
                        </Link>
                    </Button>
                    <Button asChild variant="ghost" size="sm" className="rounded-full px-6 hover:bg-muted/50 transition-all duration-200">
                        <Link href="/sign-up">
                            Sign Up
                        </Link>
                    </Button>
                </div>
                <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                    Welcome back!
                </CardTitle>
                <p className="text-muted-foreground mt-2 text-sm">
                    Sign in to continue to your workspace
                </p>
            </CardHeader>
            <CardContent className="p-8 pt-2">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                        {isPending ? "Signing in..." : "Sign In"}
                    </Button>
                    </form>
                </Form>
                
            </CardContent>
            <div className="px-8">
                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-border/50" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
                    </div>
                </div>
            </div>
            <CardContent className="p-8 pt-4">
                <Button
                    disabled={isPending}
                    variant="outline"
                    size="lg"
                    className="w-full border-2 hover:bg-muted/50 transition-all duration-200"
                >
                    <FcGoogle className="mr-2 size-5" />
                    Google    (WIP Need a Credit Card ;) 
                </Button>
            </CardContent>
        </Card>
    );
};