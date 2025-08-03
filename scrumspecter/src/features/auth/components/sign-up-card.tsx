import { z } from "zod";
import Link from "next/link";
import { FcGoogle } from "react-icons/fc";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { DottedSeparator } from "@/components/dotted-separator";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
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
    const { mutate} = useRegister();

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
        <Card className="w-full h-full md:w-[487px] border-none shadow-none">
            <CardHeader className="flex item-center justify-center text-center p-7">
                <CardTitle className="text-2xl">
                    Sign Up
                </CardTitle>
                <CardDescription>
                    By signing up, you agree to our{" "}
                    <Link href="/privacy">
                        <span className="text-blue-700">Privacy Policy</span>
                    </Link>{" "}and{" "}
                    <Link href="/terms">
                        <span className="text-blue-700">Terms of Services</span>
                    </Link>
                </CardDescription>

            </CardHeader>
            <div className="px-7 mb-2">
                <DottedSeparator />
            </div>
            <CardContent className="p-7">
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
                                        />  
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button disabled={false} size="lg" className="w-full">
                            Login
                        </Button>
                    </form>
                </Form>


                    
            </CardContent>
            <div className="px-7">
                <DottedSeparator />
            </div>
            <CardContent className="p-7 flex flex-col gap-y-4">
                <Button
                    disabled={false}
                    variant="secondary"
                    size="lg"
                    className="w-full"
                >
                    <FcGoogle className="mr-2 size-5" />
                    Login with Google    
                </Button>
            </CardContent>
        </Card>
    );
};