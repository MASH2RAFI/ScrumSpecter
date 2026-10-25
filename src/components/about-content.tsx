"use client";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
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
    RefreshCwIcon,
    LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { LogoGlyph } from "@/components/logo";

const FEATURES = [
    { icon: TargetIcon, title: "Sprint Management", description: "Set sprint duration, track story points, and monitor progress with real-time sprint timers.", badge: "Core Feature" },
    { icon: UsersIcon, title: "Team Collaboration", description: "Invite team members, assign tasks, and track individual contributions across projects.", badge: "Essential" },
    { icon: BarChart3Icon, title: "Analytics Dashboard", description: "Comprehensive analytics with capacity calculator, burndown charts, velocity tracking, and sprint reports.", badge: "Advanced" },
    { icon: CalendarIcon, title: "Multiple Views", description: "Switch between table, Kanban board, and calendar views to manage tasks your way.", badge: "Flexible" },
    { icon: CheckCircleIcon, title: "Task Management", description: "Create, assign, and track tasks with story points, due dates, and status updates.", badge: "Core Feature" },
    { icon: TrendingUpIcon, title: "Progress Tracking", description: "Monitor project progress with visual indicators and detailed reporting.", badge: "Essential" },
    { icon: ListTodoIcon, title: "Personal Todo Widget", description: "Keep track of personal tasks with built-in timers, separate from project tasks.", badge: "New!" },
    { icon: RefreshCwIcon, title: "Real-time Sync", description: "All changes sync instantly across team members and devices for seamless collaboration.", badge: "Live" },
    { icon: SmartphoneIcon, title: "Mobile Responsive", description: "Fully responsive design that works perfectly on desktop, tablet, and mobile devices.", badge: "Universal" },
];

const BADGE_CLASSES: Record<string, string> = {
    "New!": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    "Core Feature": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    "Essential": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
};
const DEFAULT_BADGE_CLASS = "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";

const ANALYTICS_TOOLS = [
    { icon: CalculatorIcon, title: "Capacity Calculator", description: "Calculate team sprint capacity based on member availability and daily hours." },
    { icon: TrendingUpIcon, title: "Burndown Chart", description: "Visualize sprint progress and compare actual vs ideal burndown rates." },
    { icon: BarChart3Icon, title: "Velocity Tracker", description: "Track team velocity across multiple sprints and identify trends." },
    { icon: FileTextIcon, title: "Sprint Report Generator", description: "Generate comprehensive markdown reports with all sprint metrics and insights." },
];

const BENEFITS = [
    { icon: ZapIcon, color: "text-green-600", title: "Lightning Fast", description: "Built with Next.js 14, TypeScript, and optimized for performance with sub-second load times." },
    { icon: ShieldIcon, color: "text-primary", title: "Enterprise Security", description: "Self-hosted PostgreSQL over TLS, argon2-hashed passwords, and secure session cookies." },
    { icon: StarIcon, color: "text-yellow-600", title: "Modern Design", description: "Beautiful, responsive interface with dark/light mode support and intuitive UX." },
    { icon: CloudIcon, color: "text-blue-600", title: "Cloud Native", description: "Fully cloud-based with automatic backups, real-time sync, and 99.9% uptime." },
    { icon: GlobeIcon, color: "text-purple-600", title: "Global Access", description: "Access your projects from anywhere in the world with our global CDN infrastructure." },
    { icon: HeartIcon, color: "text-red-600", title: "User-Focused", description: "Built by developers, for developers. Every feature is designed with user experience in mind." },
];

const STATS = [
    { number: "10K+", label: "Active Users", icon: UsersIcon },
    { number: "50K+", label: "Tasks Completed", icon: CheckCircleIcon },
    { number: "99.9%", label: "Uptime", icon: ShieldIcon },
    { number: "24/7", label: "Support", icon: HeartIcon },
];

const TECHNOLOGIES = [
    { name: "Next.js 14", description: "React framework with App Router" },
    { name: "TypeScript", description: "Type-safe development" },
    { name: "Tailwind CSS", description: "Utility-first styling" },
    { name: "PostgreSQL", description: "Self-hosted database" },
    { name: "React Query", description: "Data fetching & caching" },
    { name: "Lucide Icons", description: "Beautiful icon library" },
];

const HERO_HIGHLIGHTS = [
    { icon: RocketIcon, label: "Lightning Fast" },
    { icon: ShieldIcon, label: "Enterprise Secure" },
    { icon: GlobeIcon, label: "Global Access" },
];

interface StepItem {
    icon: LucideIcon;
    // Full class strings so Tailwind can see them
    bg: string;
    color: string;
    label?: string;
    text: string;
}

const STEPS: { title: string; items: StepItem[] }[] = [
    {
        title: "Create Your Account & Workspace",
        items: [
            { icon: UserPlusIcon, bg: "bg-blue-100 dark:bg-blue-900/30", color: "text-blue-600 dark:text-blue-400", text: "Sign up for a new account or sign in with existing credentials" },
            { icon: SettingsIcon, bg: "bg-green-100 dark:bg-green-900/30", color: "text-green-600 dark:text-green-400", text: "Create your first workspace and set up sprint settings (duration, sprint number)" },
            { icon: UsersIcon, bg: "bg-purple-100 dark:bg-purple-900/30", color: "text-purple-600 dark:text-purple-400", text: "Invite team members to collaborate on projects" },
        ],
    },
    {
        title: "Create Your First Project",
        items: [
            { icon: PlusIcon, bg: "bg-orange-100 dark:bg-orange-900/30", color: "text-orange-600 dark:text-orange-400", text: "Click \"New Project\" to create a project with sprint duration and sprint number" },
            { icon: FolderPlusIcon, bg: "bg-indigo-100 dark:bg-indigo-900/30", color: "text-indigo-600 dark:text-indigo-400", text: "Set project name, description, and sprint settings" },
            { icon: ClockIcon, bg: "bg-red-100 dark:bg-red-900/30", color: "text-red-600 dark:text-red-400", text: "The sprint timer will automatically start counting down" },
        ],
    },
    {
        title: "Add Tasks with Story Points",
        items: [
            { icon: ListTodoIcon, bg: "bg-yellow-100 dark:bg-yellow-900/30", color: "text-yellow-600 dark:text-yellow-400", text: "Create tasks and assign story points during task creation" },
            { icon: TargetIcon, bg: "bg-teal-100 dark:bg-teal-900/30", color: "text-teal-600 dark:text-teal-400", text: "Assign tasks to team members and set due dates" },
            { icon: CheckCircleIcon, bg: "bg-pink-100 dark:bg-pink-900/30", color: "text-pink-600 dark:text-pink-400", text: "Use different task statuses: TODO, IN_PROGRESS, DONE" },
        ],
    },
    {
        title: "Manage Tasks in Multiple Views",
        items: [
            { icon: ListTodoIcon, bg: "bg-slate-100 dark:bg-slate-900/30", color: "text-slate-600 dark:text-slate-400", label: "Table View:", text: "Detailed task list with sorting and filtering" },
            { icon: KanbanIcon, bg: "bg-cyan-100 dark:bg-cyan-900/30", color: "text-cyan-600 dark:text-cyan-400", label: "Kanban View:", text: "Drag and drop tasks between columns" },
            { icon: CalendarDaysIcon, bg: "bg-emerald-100 dark:bg-emerald-900/30", color: "text-emerald-600 dark:text-emerald-400", label: "Calendar View:", text: "Visual timeline of tasks and deadlines" },
        ],
    },
    {
        title: "Track Progress with Analytics",
        items: [
            { icon: CalculatorIcon, bg: "bg-violet-100 dark:bg-violet-900/30", color: "text-violet-600 dark:text-violet-400", label: "Capacity Calculator:", text: "Calculate team sprint capacity based on availability" },
            { icon: TrendingUpIcon, bg: "bg-rose-100 dark:bg-rose-900/30", color: "text-rose-600 dark:text-rose-400", label: "Burndown Chart:", text: "Visualize sprint progress vs ideal burndown" },
            { icon: BarChartIcon, bg: "bg-amber-100 dark:bg-amber-900/30", color: "text-amber-600 dark:text-amber-400", label: "Velocity Tracker:", text: "Monitor team velocity across multiple sprints" },
            { icon: FileTextIcon, bg: "bg-lime-100 dark:bg-lime-900/30", color: "text-lime-600 dark:text-lime-400", label: "Sprint Report Generator:", text: "Generate comprehensive markdown reports" },
        ],
    },
    {
        title: "Monitor Sprint Progress",
        items: [
            { icon: ClockIcon, bg: "bg-sky-100 dark:bg-sky-900/30", color: "text-sky-600 dark:text-sky-400", text: "View real-time sprint countdown timers on the dashboard" },
            { icon: TargetIcon, bg: "bg-fuchsia-100 dark:bg-fuchsia-900/30", color: "text-fuchsia-600 dark:text-fuchsia-400", text: "Track completed vs remaining story points" },
            { icon: EyeIcon, bg: "bg-stone-100 dark:bg-stone-900/30", color: "text-stone-600 dark:text-stone-400", text: "Monitor individual team member contributions" },
        ],
    },
];

const TIPS = [
    {
        icon: TargetIcon,
        title: "Story Points",
        items: [
            "Use Fibonacci sequence (1, 2, 3, 5, 8, 13)",
            "Estimate based on complexity, not time",
            "Keep estimates consistent across the team",
            "Review and adjust estimates after completion",
        ],
    },
    {
        icon: UsersIcon,
        title: "Team Management",
        items: [
            "Set realistic daily capacity (6-8 hours)",
            "Account for meetings and overhead time",
            "Update availability for holidays/vacations",
            "Regular team retrospectives for improvement",
        ],
    },
    {
        icon: BarChart3Icon,
        title: "Sprint Planning",
        items: [
            "Plan sprints based on team velocity",
            "Include buffer time for unexpected issues",
            "Break large tasks into smaller, manageable pieces",
            "Review burndown charts daily",
        ],
    },
    {
        icon: CalendarIcon,
        title: "Task Management",
        items: [
            "Use clear, descriptive task names",
            "Set realistic due dates",
            "Update task status regularly",
            "Use filters to focus on relevant tasks",
        ],
    },
];

const FOOTER_LINKS = ["Privacy Policy", "Terms of Service", "Support", "Documentation"];

// The brand glyph in the hero/footer circles, which supply their own background
const LogoMark = ({ width, height }: { width: number; height: number }) => (
    <LogoGlyph size={Math.max(width, height)} className="text-primary-foreground" />
);

const SectionSeparator = () => (
    <div className="px-7">
        <DottedSeparator />
    </div>
);

const GRADIENT_TEXT = "bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent";
const ICON_TILE = "bg-gradient-to-r from-primary/10 to-primary/5 group-hover:from-primary/20 group-hover:to-primary/10 transition-all duration-300";

// Large gradient section heading (features, how-to, stats, tech stack)
const FeaturedHeader = ({ title, description }: { title: string; description: string }) => (
    <CardHeader className="p-10">
        <CardTitle className={cn("text-3xl text-center mb-4 font-bold", GRADIENT_TEXT)}>
            {title}
        </CardTitle>
        <CardDescription className="text-center text-lg text-muted-foreground">
            {description}
        </CardDescription>
    </CardHeader>
);

const PlainHeader = ({ title, description }: { title: string; description?: string }) => (
    <CardHeader className="p-7">
        <CardTitle className="text-2xl text-center mb-2">
            {title}
        </CardTitle>
        {description && (
            <CardDescription className="text-center">
                {description}
            </CardDescription>
        )}
    </CardHeader>
);

export const AboutContent = () => {
    return (
        <div className="w-full max-w-5xl space-y-12">
            {/* Hero Section */}
            <Card className="border-0 shadow-2xl bg-gradient-to-br from-background via-background to-primary/5 backdrop-blur-sm relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/10"></div>
                <CardHeader className="text-center p-12 relative z-10">
                    <div className="mb-6">
                        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-r from-primary to-primary/70 mb-6 shadow-lg">
                            <div className="w-10 h-8 flex items-center justify-center">
                                <LogoMark width={40} height={32} />
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
                        {HERO_HIGHLIGHTS.map(({ icon: Icon, label }) => (
                            <div key={label} className="flex items-center gap-2">
                                <Icon className="h-4 w-4 text-primary" />
                                <span>{label}</span>
                            </div>
                        ))}
                    </div>
                </CardHeader>
            </Card>

            <SectionSeparator />

            {/* Features Section */}
            <Card className="border-0 shadow-xl bg-gradient-to-br from-background to-muted/10">
                <FeaturedHeader
                    title="Key Features"
                    description="Everything you need to manage projects and track team performance"
                />
                <CardContent className="p-10 pt-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {FEATURES.map(({ icon: Icon, title, description, badge }) => (
                            <div key={title} className="group flex flex-col items-center text-center space-y-4 p-6 rounded-2xl bg-gradient-to-br from-background to-muted/20 border border-border/50 hover:border-primary/30 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 relative">
                                <div className="absolute top-4 right-4">
                                    <Badge
                                        variant={badge === "New!" ? "default" : "secondary"}
                                        className={`text-xs ${BADGE_CLASSES[badge] ?? DEFAULT_BADGE_CLASS}`}
                                    >
                                        {badge}
                                    </Badge>
                                </div>
                                <div className={cn("p-4 rounded-2xl", ICON_TILE)}>
                                    <Icon className="h-6 w-6 text-primary" />
                                </div>
                                <h3 className="font-bold text-xl group-hover:text-primary transition-colors duration-300">{title}</h3>
                                <p className="text-muted-foreground leading-relaxed">{description}</p>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <SectionSeparator />

            {/* Analytics Tools Section */}
            <Card className="border-none shadow-none">
                <PlainHeader
                    title="Analytics & Reporting"
                    description="Powerful tools to analyze team performance and sprint progress"
                />
                <CardContent className="p-7">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {ANALYTICS_TOOLS.map(({ icon: Icon, title, description }) => (
                            <div key={title} className="flex items-start space-x-3 p-4 rounded-lg border">
                                <div className="p-1 rounded bg-primary/10">
                                    <Icon className="h-5 w-5" />
                                </div>
                                <div>
                                    <h4 className="font-semibold">{title}</h4>
                                    <p className="text-sm text-muted-foreground">{description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <SectionSeparator />

            {/* Benefits Section */}
            <Card className="border-none shadow-none">
                <PlainHeader title="Why Choose ScrumSpecter?" />
                <CardContent className="p-7">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {BENEFITS.map(({ icon: Icon, color, title, description }) => (
                            <div key={title} className="group text-center space-y-4 p-6 rounded-xl border border-border/50 hover:border-primary/30 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                                <div className="flex justify-center">
                                    <div className={cn("p-3 rounded-2xl", ICON_TILE)}>
                                        <Icon className={cn("h-5 w-5", color)} />
                                    </div>
                                </div>
                                <h3 className="font-semibold text-lg group-hover:text-primary transition-colors duration-300">{title}</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <SectionSeparator />

            {/* Instructions Section */}
            <Card className="border-0 shadow-xl bg-gradient-to-br from-background to-muted/10">
                <FeaturedHeader
                    title="How to Use ScrumSpecter"
                    description="Step-by-step guide to get the most out of your project management experience"
                />
                <CardContent className="p-10 pt-0 space-y-10">
                    {STEPS.map((step, index) => (
                        <div key={step.title} className="group space-y-6 p-6 rounded-2xl bg-gradient-to-r from-primary/5 to-transparent border border-primary/10 hover:border-primary/20 transition-all duration-300">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-bold text-lg shadow-lg">
                                    {index + 1}
                                </div>
                                <h3 className="text-2xl font-bold group-hover:text-primary transition-colors duration-300">{step.title}</h3>
                            </div>
                            <div className="ml-16 space-y-4">
                                {step.items.map(({ icon: Icon, bg, color, label, text }) => (
                                    <div key={text} className="flex items-start gap-3">
                                        <div className={cn("flex items-center justify-center w-6 h-6 rounded-full mt-1 flex-shrink-0", bg)}>
                                            <Icon className={cn("h-3 w-3", color)} />
                                        </div>
                                        <p className="text-muted-foreground leading-relaxed">
                                            {label && <span className="font-semibold text-foreground">{label}</span>}
                                            {label ? ` ${text}` : text}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>

            <SectionSeparator />

            {/* Tips & Best Practices */}
            <Card className="border-none shadow-none">
                <PlainHeader
                    title="Tips & Best Practices"
                    description="Get the most out of ScrumSpecter with these helpful tips"
                />
                <CardContent className="p-7">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {TIPS.map(({ icon: Icon, title, items }) => (
                            <div key={title} className="space-y-4">
                                <h4 className="font-semibold text-lg flex items-center gap-2">
                                    <Icon className="h-5 w-5 text-primary" />
                                    {title}
                                </h4>
                                <ul className="space-y-2 text-sm text-muted-foreground">
                                    {items.map((item) => (
                                        <li key={item}>• {item}</li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <SectionSeparator />

            {/* Stats Section */}
            <Card className="border-0 shadow-xl bg-gradient-to-r from-primary/5 via-background to-primary/5">
                <FeaturedHeader
                    title="Trusted by Teams Worldwide"
                    description="Join thousands of teams already using ScrumSpecter to deliver exceptional results"
                />
                <CardContent className="p-10 pt-0">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                        {STATS.map(({ icon: Icon, number, label }) => (
                            <div key={label} className="text-center space-y-3 group">
                                <div className="flex justify-center">
                                    <div className={cn("p-4 rounded-2xl", ICON_TILE)}>
                                        <Icon className="h-4 w-4" />
                                    </div>
                                </div>
                                <div className="text-3xl font-bold text-primary group-hover:scale-110 transition-transform duration-300">
                                    {number}
                                </div>
                                <div className="text-sm text-muted-foreground font-medium">
                                    {label}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <SectionSeparator />

            {/* Technology Stack Section */}
            <Card className="border-0 shadow-xl bg-gradient-to-br from-background to-muted/10">
                <FeaturedHeader
                    title="Built with Modern Technology"
                    description="Powered by cutting-edge technologies for optimal performance and reliability"
                />
                <CardContent className="p-10 pt-0">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                        {TECHNOLOGIES.map((tech) => (
                            <div key={tech.name} className="group p-4 rounded-xl border border-border/50 hover:border-primary/30 hover:shadow-md transition-all duration-300 hover:-translate-y-1">
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

            <SectionSeparator />

            {/* Getting Started Section */}
            <Card className="border-0 shadow-2xl bg-gradient-to-br from-primary/10 via-background to-primary/5">
                <CardHeader className="p-12 text-center">
                    <div className="mb-6">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-r from-primary to-primary/80 mb-6">
                            <ArrowRightIcon className="h-8 w-8 text-primary-foreground" />
                        </div>
                    </div>
                    <CardTitle className={cn("text-4xl font-bold mb-4", GRADIENT_TEXT)}>
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
                        <LogoMark width={20} height={16} />
                    </div>
                    <span className={cn("text-xl font-bold", GRADIENT_TEXT)}>
                        ScrumSpecter
                    </span>
                </div>
                <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
                    © 2024 ScrumSpecter. Built with Next.js 14, TypeScript, Tailwind CSS, and PostgreSQL.
                    Designed for modern agile teams worldwide.
                </p>
                <div className="flex justify-center gap-6 text-xs text-muted-foreground">
                    {FOOTER_LINKS.map((link) => (
                        <span key={link}>{link}</span>
                    ))}
                </div>
            </div>
        </div>
    );
};
