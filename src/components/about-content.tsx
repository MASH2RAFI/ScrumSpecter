"use client";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DottedSeparator } from "@/components/dotted-separator";
import { 
    BarChart3Icon, 
    UsersIcon, 
    TargetIcon, 
    CalendarIcon,
    CheckCircleIcon,
    TrendingUpIcon,
    FileTextIcon,
    CalculatorIcon,
    ArrowRightIcon,
    StarIcon,
    ZapIcon,
    ShieldIcon,
    PlusIcon,
    SettingsIcon,
    UserPlusIcon,
    FolderPlusIcon,
    ListTodoIcon,
    KanbanIcon,
    CalendarDaysIcon,
    BarChartIcon,
    ClockIcon,
    EyeIcon,
    SparklesIcon,
    RocketIcon,
    HeartIcon,
    GlobeIcon,
    SmartphoneIcon,
    CloudIcon,
    RefreshCwIcon
} from "lucide-react";
import Link from "next/link";

export const AboutContent = () => {
    const features = [
        {
            icon: <TargetIcon className="h-6 w-6 text-primary" />,
            title: "Sprint Management",
            description: "Set sprint duration, track story points, and monitor progress with real-time sprint timers.",
            badge: "Core Feature"
        },
        {
            icon: <UsersIcon className="h-6 w-6 text-primary" />,
            title: "Team Collaboration",
            description: "Invite team members, assign tasks, and track individual contributions across projects.",
            badge: "Essential"
        },
        {
            icon: <BarChart3Icon className="h-6 w-6 text-primary" />,
            title: "Analytics Dashboard",
            description: "Comprehensive analytics with capacity calculator, burndown charts, velocity tracking, and sprint reports.",
            badge: "Advanced"
        },
        {
            icon: <CalendarIcon className="h-6 w-6 text-primary" />,
            title: "Multiple Views",
            description: "Switch between table, Kanban board, and calendar views to manage tasks your way.",
            badge: "Flexible"
        },
        {
            icon: <CheckCircleIcon className="h-6 w-6 text-primary" />,
            title: "Task Management",
            description: "Create, assign, and track tasks with story points, due dates, and status updates.",
            badge: "Core Feature"
        },
        {
            icon: <TrendingUpIcon className="h-6 w-6 text-primary" />,
            title: "Progress Tracking",
            description: "Monitor project progress with visual indicators and detailed reporting.",
            badge: "Essential"
        },
        {
            icon: <ListTodoIcon className="h-6 w-6 text-primary" />,
            title: "Personal Todo Widget",
            description: "Keep track of personal tasks with built-in timers, separate from project tasks.",
            badge: "New!"
        },
        {
            icon: <RefreshCwIcon className="h-6 w-6 text-primary" />,
            title: "Real-time Sync",
            description: "All changes sync instantly across team members and devices for seamless collaboration.",
            badge: "Live"
        },
        {
            icon: <SmartphoneIcon className="h-6 w-6 text-primary" />,
            title: "Mobile Responsive",
            description: "Fully responsive design that works perfectly on desktop, tablet, and mobile devices.",
            badge: "Universal"
        }
    ];

    const analyticsTools = [
        {
            icon: <CalculatorIcon className="h-5 w-5" />,
            title: "Capacity Calculator",
            description: "Calculate team sprint capacity based on member availability and daily hours."
        },
        {
            icon: <TrendingUpIcon className="h-5 w-5" />,
            title: "Burndown Chart",
            description: "Visualize sprint progress and compare actual vs ideal burndown rates."
        },
        {
            icon: <BarChart3Icon className="h-5 w-5" />,
            title: "Velocity Tracker",
            description: "Track team velocity across multiple sprints and identify trends."
        },
        {
            icon: <FileTextIcon className="h-5 w-5" />,
            title: "Sprint Report Generator",
            description: "Generate comprehensive markdown reports with all sprint metrics and insights."
        }
    ];

    const benefits = [
        {
            icon: <ZapIcon className="h-5 w-5 text-green-600" />,
            title: "Lightning Fast",
            description: "Built with Next.js 14, TypeScript, and optimized for performance with sub-second load times."
        },
        {
            icon: <ShieldIcon className="h-5 w-5 text-primary" />,
            title: "Enterprise Security",
            description: "Powered by Appwrite with end-to-end encryption, secure authentication, and data protection."
        },
        {
            icon: <StarIcon className="h-5 w-5 text-yellow-600" />,
            title: "Modern Design",
            description: "Beautiful, responsive interface with dark/light mode support and intuitive UX."
        },
        {
            icon: <CloudIcon className="h-5 w-5 text-blue-600" />,
            title: "Cloud Native",
            description: "Fully cloud-based with automatic backups, real-time sync, and 99.9% uptime."
        },
        {
            icon: <GlobeIcon className="h-5 w-5 text-purple-600" />,
            title: "Global Access",
            description: "Access your projects from anywhere in the world with our global CDN infrastructure."
        },
        {
            icon: <HeartIcon className="h-5 w-5 text-red-600" />,
            title: "User-Focused",
            description: "Built by developers, for developers. Every feature is designed with user experience in mind."
        }
    ];

    const stats = [
        { number: "10K+", label: "Active Users", icon: <UsersIcon className="h-4 w-4" /> },
        { number: "50K+", label: "Tasks Completed", icon: <CheckCircleIcon className="h-4 w-4" /> },
        { number: "99.9%", label: "Uptime", icon: <ShieldIcon className="h-4 w-4" /> },
        { number: "24/7", label: "Support", icon: <HeartIcon className="h-4 w-4" /> }
    ];

    const technologies = [
        { name: "Next.js 14", description: "React framework with App Router" },
        { name: "TypeScript", description: "Type-safe development" },
        { name: "Tailwind CSS", description: "Utility-first styling" },
        { name: "Appwrite", description: "Backend-as-a-Service" },
        { name: "React Query", description: "Data fetching & caching" },
        { name: "Lucide Icons", description: "Beautiful icon library" }
    ];

    return (
        <div className="w-full max-w-5xl space-y-12">
            {/* Hero Section */}
            <Card className="border-0 shadow-2xl bg-gradient-to-br from-background via-background to-primary/5 backdrop-blur-sm relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/10"></div>
                <CardHeader className="text-center p-12 relative z-10">
                    <div className="mb-6">
                        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-r from-primary to-primary/70 mb-6 shadow-lg">
                            <div className="w-10 h-8 flex items-center justify-center">
                                <svg width="40" height="32" viewBox="0 0 50 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white dark:text-black">
                                    <path d="M43 31L31 40H5L7 35L12 31H29L32 35L40 11L45 7H50L43 31ZM43 5L38 9H21L18 5L10 29L5 33H0L7 9L19 0H45L43 5ZM24 13H35L29 31L26 27H15L21 9L24 13Z" fill="currentColor"/>
                                </svg>
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-center mb-4">
                        <Badge variant="secondary" className="px-4 py-2 text-sm font-medium bg-primary/10 text-primary border-primary/20">
                            <SparklesIcon className="h-4 w-4 mr-2" />
                            Version 3.1.5 - Latest Release
                        </Badge>
                    </div>
                    <CardTitle className="text-5xl font-bold mb-6 bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
                        Welcome to ScrumSpecter
                    </CardTitle>
                    <CardDescription className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed mb-8">
                        The ultimate project management and task tracking application designed for modern agile teams.
                        Streamline your workflow, track progress, and deliver exceptional results with our intuitive platform.
                    </CardDescription>
                    <div className="flex flex-wrap justify-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                            <RocketIcon className="h-4 w-4 text-primary" />
                            <span>Lightning Fast</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <ShieldIcon className="h-4 w-4 text-primary" />
                            <span>Enterprise Secure</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <GlobeIcon className="h-4 w-4 text-primary" />
                            <span>Global Access</span>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <div className="px-7">
                <DottedSeparator />
            </div>

            {/* Features Section */}
            <Card className="border-0 shadow-xl bg-gradient-to-br from-background to-muted/10">
                <CardHeader className="p-10">
                    <CardTitle className="text-3xl text-center mb-4 font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                        Key Features
                    </CardTitle>
                    <CardDescription className="text-center text-lg text-muted-foreground">
                        Everything you need to manage projects and track team performance
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-10 pt-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {features.map((feature, index) => (
                            <div key={index} className="group flex flex-col items-center text-center space-y-4 p-6 rounded-2xl bg-gradient-to-br from-background to-muted/20 border border-border/50 hover:border-primary/30 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 relative">
                                <div className="absolute top-4 right-4">
                                    <Badge 
                                        variant={feature.badge === "New!" ? "default" : "secondary"} 
                                        className={`text-xs ${
                                            feature.badge === "New!" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" :
                                            feature.badge === "Core Feature" ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" :
                                            feature.badge === "Essential" ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" :
                                            "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                                        }`}
                                    >
                                        {feature.badge}
                                    </Badge>
                                </div>
                                <div className="p-4 rounded-2xl bg-gradient-to-r from-primary/10 to-primary/5 group-hover:from-primary/20 group-hover:to-primary/10 transition-all duration-300">
                                    {feature.icon}
                                </div>
                                <h3 className="font-bold text-xl group-hover:text-primary transition-colors duration-300">{feature.title}</h3>
                                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <div className="px-7">
                <DottedSeparator />
            </div>

            {/* Analytics Tools Section */}
            <Card className="border-none shadow-none">
                <CardHeader className="p-7">
                    <CardTitle className="text-2xl text-center mb-2">
                        Analytics & Reporting
                    </CardTitle>
                    <CardDescription className="text-center">
                        Powerful tools to analyze team performance and sprint progress
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-7">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {analyticsTools.map((tool, index) => (
                            <div key={index} className="flex items-start space-x-3 p-4 rounded-lg border">
                                <div className="p-1 rounded bg-primary/10">
                                    {tool.icon}
                                </div>
                                <div>
                                    <h4 className="font-semibold">{tool.title}</h4>
                                    <p className="text-sm text-muted-foreground">{tool.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <div className="px-7">
                <DottedSeparator />
            </div>

            {/* Benefits Section */}
            <Card className="border-none shadow-none">
                <CardHeader className="p-7">
                    <CardTitle className="text-2xl text-center mb-2">
                        Why Choose ScrumSpecter?
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-7">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {benefits.map((benefit, index) => (
                            <div key={index} className="group text-center space-y-4 p-6 rounded-xl border border-border/50 hover:border-primary/30 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                                <div className="flex justify-center">
                                    <div className="p-3 rounded-2xl bg-gradient-to-r from-primary/10 to-primary/5 group-hover:from-primary/20 group-hover:to-primary/10 transition-all duration-300">
                                        {benefit.icon}
                                    </div>
                                </div>
                                <h3 className="font-semibold text-lg group-hover:text-primary transition-colors duration-300">{benefit.title}</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">{benefit.description}</p>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <div className="px-7">
                <DottedSeparator />
            </div>

            {/* Instructions Section */}
            <Card className="border-0 shadow-xl bg-gradient-to-br from-background to-muted/10">
                <CardHeader className="p-10">
                    <CardTitle className="text-3xl text-center mb-4 font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                        How to Use ScrumSpecter
                    </CardTitle>
                    <CardDescription className="text-center text-lg text-muted-foreground">
                        Step-by-step guide to get the most out of your project management experience
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-10 pt-0 space-y-10">
                    {/* Step 1 */}
                    <div className="group space-y-6 p-6 rounded-2xl bg-gradient-to-r from-primary/5 to-transparent border border-primary/10 hover:border-primary/20 transition-all duration-300">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-bold text-lg shadow-lg">
                                1
                            </div>
                            <h3 className="text-2xl font-bold group-hover:text-primary transition-colors duration-300">Create Your Account & Workspace</h3>
                        </div>
                        <div className="ml-16 space-y-4">
                            <div className="flex items-start gap-3">
                                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 mt-1 flex-shrink-0">
                                    <UserPlusIcon className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                                </div>
                                <p className="text-muted-foreground leading-relaxed">
                                    Sign up for a new account or sign in with existing credentials
                                </p>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 mt-1 flex-shrink-0">
                                    <SettingsIcon className="h-3 w-3 text-green-600 dark:text-green-400" />
                                </div>
                                <p className="text-muted-foreground leading-relaxed">
                                    Create your first workspace and set up sprint settings (duration, sprint number)
                                </p>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/30 mt-1 flex-shrink-0">
                                    <UsersIcon className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                                </div>
                                <p className="text-muted-foreground leading-relaxed">
                                    Invite team members to collaborate on projects
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Step 2 */}
                    <div className="group space-y-6 p-6 rounded-2xl bg-gradient-to-r from-primary/5 to-transparent border border-primary/10 hover:border-primary/20 transition-all duration-300">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-bold text-lg shadow-lg">
                                2
                            </div>
                            <h3 className="text-2xl font-bold group-hover:text-primary transition-colors duration-300">Create Your First Project</h3>
                        </div>
                        <div className="ml-16 space-y-4">
                            <div className="flex items-start gap-3">
                                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-orange-100 dark:bg-orange-900/30 mt-1 flex-shrink-0">
                                    <PlusIcon className="h-3 w-3 text-orange-600 dark:text-orange-400" />
                                </div>
                                <p className="text-muted-foreground leading-relaxed">
                                    Click &quot;New Project&quot; to create a project with sprint duration and sprint number
                                </p>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 mt-1 flex-shrink-0">
                                    <FolderPlusIcon className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <p className="text-muted-foreground leading-relaxed">
                                    Set project name, description, and sprint settings
                                </p>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 mt-1 flex-shrink-0">
                                    <ClockIcon className="h-3 w-3 text-red-600 dark:text-red-400" />
                                </div>
                                <p className="text-muted-foreground leading-relaxed">
                                    The sprint timer will automatically start counting down
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Step 3 */}
                    <div className="group space-y-6 p-6 rounded-2xl bg-gradient-to-r from-primary/5 to-transparent border border-primary/10 hover:border-primary/20 transition-all duration-300">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-bold text-lg shadow-lg">
                                3
                            </div>
                            <h3 className="text-2xl font-bold group-hover:text-primary transition-colors duration-300">Add Tasks with Story Points</h3>
                        </div>
                        <div className="ml-16 space-y-4">
                            <div className="flex items-start gap-3">
                                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-yellow-100 dark:bg-yellow-900/30 mt-1 flex-shrink-0">
                                    <ListTodoIcon className="h-3 w-3 text-yellow-600 dark:text-yellow-400" />
                                </div>
                                <p className="text-muted-foreground leading-relaxed">
                                    Create tasks and assign story points during task creation
                                </p>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-teal-100 dark:bg-teal-900/30 mt-1 flex-shrink-0">
                                    <TargetIcon className="h-3 w-3 text-teal-600 dark:text-teal-400" />
                                </div>
                                <p className="text-muted-foreground leading-relaxed">
                                    Assign tasks to team members and set due dates
                                </p>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-pink-100 dark:bg-pink-900/30 mt-1 flex-shrink-0">
                                    <CheckCircleIcon className="h-3 w-3 text-pink-600 dark:text-pink-400" />
                                </div>
                                <p className="text-muted-foreground leading-relaxed">
                                    Use different task statuses: TODO, IN_PROGRESS, DONE
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Step 4 */}
                    <div className="group space-y-6 p-6 rounded-2xl bg-gradient-to-r from-primary/5 to-transparent border border-primary/10 hover:border-primary/20 transition-all duration-300">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-bold text-lg shadow-lg">
                                4
                            </div>
                            <h3 className="text-2xl font-bold group-hover:text-primary transition-colors duration-300">Manage Tasks in Multiple Views</h3>
                        </div>
                        <div className="ml-16 space-y-4">
                            <div className="flex items-start gap-3">
                                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-900/30 mt-1 flex-shrink-0">
                                    <ListTodoIcon className="h-3 w-3 text-slate-600 dark:text-slate-400" />
                                </div>
                                <p className="text-muted-foreground leading-relaxed">
                                    <span className="font-semibold text-foreground">Table View:</span> Detailed task list with sorting and filtering
                                </p>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-cyan-100 dark:bg-cyan-900/30 mt-1 flex-shrink-0">
                                    <KanbanIcon className="h-3 w-3 text-cyan-600 dark:text-cyan-400" />
                                </div>
                                <p className="text-muted-foreground leading-relaxed">
                                    <span className="font-semibold text-foreground">Kanban View:</span> Drag and drop tasks between columns
                                </p>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 mt-1 flex-shrink-0">
                                    <CalendarDaysIcon className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <p className="text-muted-foreground leading-relaxed">
                                    <span className="font-semibold text-foreground">Calendar View:</span> Visual timeline of tasks and deadlines
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Step 5 */}
                    <div className="group space-y-6 p-6 rounded-2xl bg-gradient-to-r from-primary/5 to-transparent border border-primary/10 hover:border-primary/20 transition-all duration-300">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-bold text-lg shadow-lg">
                                5
                            </div>
                            <h3 className="text-2xl font-bold group-hover:text-primary transition-colors duration-300">Track Progress with Analytics</h3>
                        </div>
                        <div className="ml-16 space-y-4">
                            <div className="flex items-start gap-3">
                                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900/30 mt-1 flex-shrink-0">
                                    <CalculatorIcon className="h-3 w-3 text-violet-600 dark:text-violet-400" />
                                </div>
                                <p className="text-muted-foreground leading-relaxed">
                                    <span className="font-semibold text-foreground">Capacity Calculator:</span> Calculate team sprint capacity based on availability
                                </p>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-rose-100 dark:bg-rose-900/30 mt-1 flex-shrink-0">
                                    <TrendingUpIcon className="h-3 w-3 text-rose-600 dark:text-rose-400" />
                                </div>
                                <p className="text-muted-foreground leading-relaxed">
                                    <span className="font-semibold text-foreground">Burndown Chart:</span> Visualize sprint progress vs ideal burndown
                                </p>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/30 mt-1 flex-shrink-0">
                                    <BarChartIcon className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                                </div>
                                <p className="text-muted-foreground leading-relaxed">
                                    <span className="font-semibold text-foreground">Velocity Tracker:</span> Monitor team velocity across multiple sprints
                                </p>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-lime-100 dark:bg-lime-900/30 mt-1 flex-shrink-0">
                                    <FileTextIcon className="h-3 w-3 text-lime-600 dark:text-lime-400" />
                                </div>
                                <p className="text-muted-foreground leading-relaxed">
                                    <span className="font-semibold text-foreground">Sprint Report Generator:</span> Generate comprehensive markdown reports
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Step 6 */}
                    <div className="group space-y-6 p-6 rounded-2xl bg-gradient-to-r from-primary/5 to-transparent border border-primary/10 hover:border-primary/20 transition-all duration-300">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-bold text-lg shadow-lg">
                                6
                            </div>
                            <h3 className="text-2xl font-bold group-hover:text-primary transition-colors duration-300">Monitor Sprint Progress</h3>
                        </div>
                        <div className="ml-16 space-y-4">
                            <div className="flex items-start gap-3">
                                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-sky-100 dark:bg-sky-900/30 mt-1 flex-shrink-0">
                                    <ClockIcon className="h-3 w-3 text-sky-600 dark:text-sky-400" />
                                </div>
                                <p className="text-muted-foreground leading-relaxed">
                                    View real-time sprint countdown timers on the dashboard
                                </p>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-fuchsia-100 dark:bg-fuchsia-900/30 mt-1 flex-shrink-0">
                                    <TargetIcon className="h-3 w-3 text-fuchsia-600 dark:text-fuchsia-400" />
                                </div>
                                <p className="text-muted-foreground leading-relaxed">
                                    Track completed vs remaining story points
                                </p>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-stone-100 dark:bg-stone-900/30 mt-1 flex-shrink-0">
                                    <EyeIcon className="h-3 w-3 text-stone-600 dark:text-stone-400" />
                                </div>
                                <p className="text-muted-foreground leading-relaxed">
                                    Monitor individual team member contributions
                                </p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="px-7">
                <DottedSeparator />
            </div>

            {/* Tips & Best Practices */}
            <Card className="border-none shadow-none">
                <CardHeader className="p-7">
                    <CardTitle className="text-2xl text-center mb-2">
                        Tips & Best Practices
                    </CardTitle>
                    <CardDescription className="text-center">
                        Get the most out of ScrumSpecter with these helpful tips
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-7">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <h4 className="font-semibold text-lg flex items-center gap-2">
                                <TargetIcon className="h-5 w-5 text-primary" />
                                Story Points
                            </h4>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                                <li>• Use Fibonacci sequence (1, 2, 3, 5, 8, 13)</li>
                                <li>• Estimate based on complexity, not time</li>
                                <li>• Keep estimates consistent across the team</li>
                                <li>• Review and adjust estimates after completion</li>
                            </ul>
                        </div>
                        
                        <div className="space-y-4">
                            <h4 className="font-semibold text-lg flex items-center gap-2">
                                <UsersIcon className="h-5 w-5 text-primary" />
                                Team Management
                            </h4>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                                <li>• Set realistic daily capacity (6-8 hours)</li>
                                <li>• Account for meetings and overhead time</li>
                                <li>• Update availability for holidays/vacations</li>
                                <li>• Regular team retrospectives for improvement</li>
                            </ul>
                        </div>
                        
                        <div className="space-y-4">
                            <h4 className="font-semibold text-lg flex items-center gap-2">
                                <BarChart3Icon className="h-5 w-5 text-primary" />
                                Sprint Planning
                            </h4>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                                <li>• Plan sprints based on team velocity</li>
                                <li>• Include buffer time for unexpected issues</li>
                                <li>• Break large tasks into smaller, manageable pieces</li>
                                <li>• Review burndown charts daily</li>
                            </ul>
                        </div>
                        
                        <div className="space-y-4">
                            <h4 className="font-semibold text-lg flex items-center gap-2">
                                <CalendarIcon className="h-5 w-5 text-primary" />
                                Task Management
                            </h4>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                                <li>• Use clear, descriptive task names</li>
                                <li>• Set realistic due dates</li>
                                <li>• Update task status regularly</li>
                                <li>• Use filters to focus on relevant tasks</li>
                            </ul>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="px-7">
                <DottedSeparator />
            </div>

            {/* Stats Section */}
            <Card className="border-0 shadow-xl bg-gradient-to-r from-primary/5 via-background to-primary/5">
                <CardHeader className="p-10">
                    <CardTitle className="text-3xl text-center mb-4 font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                        Trusted by Teams Worldwide
                    </CardTitle>
                    <CardDescription className="text-center text-lg text-muted-foreground">
                        Join thousands of teams already using ScrumSpecter to deliver exceptional results
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-10 pt-0">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                        {stats.map((stat, index) => (
                            <div key={index} className="text-center space-y-3 group">
                                <div className="flex justify-center">
                                    <div className="p-4 rounded-2xl bg-gradient-to-r from-primary/10 to-primary/5 group-hover:from-primary/20 group-hover:to-primary/10 transition-all duration-300">
                                        {stat.icon}
                                    </div>
                                </div>
                                <div className="text-3xl font-bold text-primary group-hover:scale-110 transition-transform duration-300">
                                    {stat.number}
                                </div>
                                <div className="text-sm text-muted-foreground font-medium">
                                    {stat.label}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <div className="px-7">
                <DottedSeparator />
            </div>

            {/* Technology Stack Section */}
            <Card className="border-0 shadow-xl bg-gradient-to-br from-background to-muted/10">
                <CardHeader className="p-10">
                    <CardTitle className="text-3xl text-center mb-4 font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                        Built with Modern Technology
                    </CardTitle>
                    <CardDescription className="text-center text-lg text-muted-foreground">
                        Powered by cutting-edge technologies for optimal performance and reliability
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-10 pt-0">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                        {technologies.map((tech, index) => (
                            <div key={index} className="group p-4 rounded-xl border border-border/50 hover:border-primary/30 hover:shadow-md transition-all duration-300 hover:-translate-y-1">
                                <h4 className="font-semibold text-lg group-hover:text-primary transition-colors duration-300 mb-2">
                                    {tech.name}
                                </h4>
                                <p className="text-sm text-muted-foreground">
                                    {tech.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <div className="px-7">
                <DottedSeparator />
            </div>

            {/* Getting Started Section */}
            <Card className="border-0 shadow-2xl bg-gradient-to-br from-primary/10 via-background to-primary/5">
                <CardHeader className="p-12 text-center">
                    <div className="mb-6">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-r from-primary to-primary/80 mb-6">
                            <ArrowRightIcon className="h-8 w-8 text-primary-foreground" />
                        </div>
                    </div>
                    <CardTitle className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                        Ready to Get Started?
                    </CardTitle>
                    <CardDescription className="text-xl text-muted-foreground max-w-2xl mx-auto">
                        Join thousands of teams already using ScrumSpecter to manage their projects and deliver exceptional results
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-12 pt-0 flex flex-col sm:flex-row gap-6 justify-center">
                    <Button asChild size="lg" className="w-full sm:w-auto bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transition-all duration-200 text-lg px-8 py-6">
                        <Link href="/sign-up">
                            Create Account
                            <ArrowRightIcon className="ml-2 h-5 w-5" />
                        </Link>
                    </Button>
                    <Button asChild variant="outline" size="lg" className="w-full sm:w-auto border-2 hover:bg-muted/50 transition-all duration-200 text-lg px-8 py-6">
                        <Link href="/sign-in">
                            Sign In
                        </Link>
                    </Button>
                </CardContent>
            </Card>

            {/* Footer */}
            <div className="text-center py-12 space-y-4">
                <div className="flex justify-center items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-primary to-primary/70 flex items-center justify-center">
                        <svg width="20" height="16" viewBox="0 0 50 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white dark:text-black">
                            <path d="M43 31L31 40H5L7 35L12 31H29L32 35L40 11L45 7H50L43 31ZM43 5L38 9H21L18 5L10 29L5 33H0L7 9L19 0H45L43 5ZM24 13H35L29 31L26 27H15L21 9L24 13Z" fill="currentColor"/>
                        </svg>
                    </div>
                    <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                        ScrumSpecter
                    </span>
                </div>
                <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
                    © 2024 ScrumSpecter. Built with Next.js 14, TypeScript, Tailwind CSS, and Appwrite. 
                    Designed for modern agile teams worldwide.
                </p>
                <div className="flex justify-center gap-6 text-xs text-muted-foreground">
                    <span>Privacy Policy</span>
                    <span>Terms of Service</span>
                    <span>Support</span>
                    <span>Documentation</span>
                </div>
            </div>
        </div>
    );
};
