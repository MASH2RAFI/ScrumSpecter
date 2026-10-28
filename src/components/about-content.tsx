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
    ZapIcon,
    ShieldIcon,
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
    SmartphoneIcon,
    CloudIcon,
    RefreshCwIcon,
    RepeatIcon,
    ShieldCheckIcon,
    GitPullRequestArrowIcon,
    BellIcon,
    ListPlusIcon,
    KeyboardIcon,
    CompassIcon,
    HomeIcon,
    CrownIcon,
    ClipboardListIcon,
    BadgeCheckIcon,
    UserIcon,
    LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { LogoGlyph } from "@/components/logo";
import { HeadingReveal, Stagger, StaggerItem } from "@/components/motion";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/features/members/permissions";
import { MemberRole } from "@/features/members/types";

const roleCard = (role: MemberRole) => ({ label: ROLE_LABELS[role], description: ROLE_DESCRIPTIONS[role] });

const FEATURES = [
    { icon: TargetIcon, title: "Sprint Management", description: "Give each project a sprint, then follow its countdown, story points and progress from the dashboard.", badge: "Core Feature" },
    { icon: CheckCircleIcon, title: "Task Management", description: "Story points, due dates, time blocks and several assignees, moving through Backlog, To Do, In Progress, In Review and Done.", badge: "Core Feature" },
    { icon: CalendarIcon, title: "Multiple Views", description: "Switch between a table, a kanban board and a calendar, with drag and drop in each. Undo is one click away.", badge: "Flexible" },
    { icon: RepeatIcon, title: "Weekly Routines", description: "Set up standups and other repeating work once. Tasks are created on their days through the sprint, skipping days off.", badge: "New!" },
    { icon: ShieldCheckIcon, title: "Roles & Review", description: "Admin, Supervisor, Reviewer, Assignee and Viewer. Assignees take work to In Review; a reviewer approves it to Done.", badge: "New!" },
    { icon: GitPullRequestArrowIcon, title: "Change Requests", description: "Assignees and reviewers propose new tasks, edits or deletions, and an admin or supervisor approves or declines them.", badge: "New!" },
    { icon: BellIcon, title: "Reminders", description: "In-app and push notifications: tomorrow's tasks at 6 PM, 30 minutes before a task ends, and decisions on your requests.", badge: "Essential" },
    { icon: ListPlusIcon, title: "Bulk Input", description: "Add many projects, tasks, routines and days off at once, checked line by line, or let your AI assistant write them.", badge: "New!" },
    { icon: BarChart3Icon, title: "Analytics Dashboard", description: "Capacity calculator, burndown chart, velocity tracker and sprint reports.", badge: "Advanced" },
    { icon: UsersIcon, title: "Team Collaboration", description: "Invite links with optional expiry and use limits, a separate view-only link, and placeholders for people who haven't joined yet.", badge: "Essential" },
    { icon: KeyboardIcon, title: "Keyboard Friendly", description: "Jump anywhere with Ctrl/⌘ K, create a task with C, search with /, and press ? for every shortcut.", badge: "Fast" },
    { icon: SmartphoneIcon, title: "Works Everywhere", description: "Responsive on phones, tablets and desktops, installable as an app, with light and dark themes.", badge: "Universal" },
];

const BADGE_CLASSES: Record<string, string> = {
    "New!": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    "Core Feature": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    "Essential": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
};
const DEFAULT_BADGE_CLASS = "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";

const ANALYTICS_TOOLS = [
    { icon: CalculatorIcon, title: "Capacity Calculator", description: "Work out the team's sprint capacity from each member's availability and daily hours." },
    { icon: TrendingUpIcon, title: "Burndown Chart", description: "Compare the remaining story points with the ideal burndown, day by day." },
    { icon: BarChart3Icon, title: "Velocity Tracker", description: "Follow completed story points across sprints and spot trends." },
    { icon: FileTextIcon, title: "Sprint Report Generator", description: "Generate a Markdown report with the sprint's metrics, ready to share." },
];

const BENEFITS = [
    { icon: ZapIcon, color: "text-green-600", title: "Fast", description: "Pages open straight from data cached in your browser, then refresh quietly in the background." },
    { icon: ShieldIcon, color: "text-primary", title: "Secure by Default", description: "Argon2-hashed passwords, lockout after repeated failed logins, single-use reset links and TLS to the database." },
    { icon: RefreshCwIcon, color: "text-blue-600", title: "Always in Sync", description: "Changes your teammates make show up on their own within a minute, without reloading." },
    { icon: CloudIcon, color: "text-sky-600", title: "Your Own Data", description: "Stored in a self-hosted PostgreSQL database with nightly backups." },
    { icon: CalendarDaysIcon, color: "text-purple-600", title: "Fits Your Calendar", description: "Public holidays, your own days off, working hours and your time zone shape routines and reminders." },
    { icon: HeartIcon, color: "text-red-600", title: "Made for Small Teams", description: "Built around how small agile teams actually plan, review and ship their sprints." },
];

const ROLES = [
    { icon: CrownIcon, ...roleCard(MemberRole.ADMIN) },
    { icon: ClipboardListIcon, ...roleCard(MemberRole.SUPERVISOR) },
    { icon: BadgeCheckIcon, ...roleCard(MemberRole.REVIEWER) },
    { icon: UserIcon, ...roleCard(MemberRole.ASSIGNEE) },
    { icon: EyeIcon, ...roleCard(MemberRole.VIEWER) },
];

const TECHNOLOGIES = [
    { name: "Next.js 14", description: "React framework with the App Router" },
    { name: "TypeScript", description: "Type-safe from database to UI" },
    { name: "Tailwind CSS", description: "Utility-first styling with shadcn/ui" },
    { name: "PostgreSQL", description: "Self-hosted, through Drizzle ORM" },
    { name: "Hono", description: "Typed API routes" },
    { name: "TanStack Query", description: "Data fetching and browser caching" },
];

const HERO_HIGHLIGHTS = [
    { icon: RocketIcon, label: "Fast" },
    { icon: ShieldIcon, label: "Secure" },
    { icon: SmartphoneIcon, label: "On any device" },
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
            { icon: UserPlusIcon, bg: "bg-blue-100 dark:bg-blue-900/30", color: "text-blue-600 dark:text-blue-400", text: "Sign up with your email or with Google" },
            { icon: SettingsIcon, bg: "bg-green-100 dark:bg-green-900/30", color: "text-green-600 dark:text-green-400", text: "Create a workspace together with its first project, or join one from an invite link" },
            { icon: CompassIcon, bg: "bg-purple-100 dark:bg-purple-900/30", color: "text-purple-600 dark:text-purple-400", text: "A short tour shows you around; replay it any time from Ctrl/⌘ K or your account menu" },
        ],
    },
    {
        title: "Bring In Your Team",
        items: [
            { icon: UsersIcon, bg: "bg-orange-100 dark:bg-orange-900/30", color: "text-orange-600 dark:text-orange-400", text: "Share the invite link from Settings → Invites, optionally with an expiry and a use limit" },
            { icon: EyeIcon, bg: "bg-indigo-100 dark:bg-indigo-900/30", color: "text-indigo-600 dark:text-indigo-400", text: "Send the separate viewer link to people who only need to follow along" },
            { icon: ShieldCheckIcon, bg: "bg-red-100 dark:bg-red-900/30", color: "text-red-600 dark:text-red-400", text: "Give each member a role in Members: Admin, Supervisor, Reviewer, Assignee or Viewer" },
        ],
    },
    {
        title: "Plan the Sprint",
        items: [
            { icon: FolderPlusIcon, bg: "bg-yellow-100 dark:bg-yellow-900/30", color: "text-yellow-600 dark:text-yellow-400", text: "Give each project a sprint start and end date; the countdown starts on its own" },
            { icon: ListTodoIcon, bg: "bg-teal-100 dark:bg-teal-900/30", color: "text-teal-600 dark:text-teal-400", text: "Add tasks with story points, one or more assignees, a due date and, if you like, a time block" },
            { icon: RepeatIcon, bg: "bg-pink-100 dark:bg-pink-900/30", color: "text-pink-600 dark:text-pink-400", text: "Set up weekly routines for repeating work, and add days off in Settings → Holidays" },
            { icon: ListPlusIcon, bg: "bg-cyan-100 dark:bg-cyan-900/30", color: "text-cyan-600 dark:text-cyan-400", text: "Lots to add? Settings → Bulk input takes many lines at once" },
        ],
    },
    {
        title: "Work in the View That Suits You",
        items: [
            { icon: HomeIcon, bg: "bg-slate-100 dark:bg-slate-900/30", color: "text-slate-600 dark:text-slate-400", label: "Home:", text: "What's overdue, due today and due tomorrow, with countdowns" },
            { icon: ListTodoIcon, bg: "bg-sky-100 dark:bg-sky-900/30", color: "text-sky-600 dark:text-sky-400", label: "Table View:", text: "Sort, filter, search and edit many tasks at once" },
            { icon: KanbanIcon, bg: "bg-cyan-100 dark:bg-cyan-900/30", color: "text-cyan-600 dark:text-cyan-400", label: "Kanban View:", text: "Drag tasks between Backlog, To Do, In Progress, In Review and Done" },
            { icon: CalendarDaysIcon, bg: "bg-emerald-100 dark:bg-emerald-900/30", color: "text-emerald-600 dark:text-emerald-400", label: "Calendar View:", text: "Drag tasks onto days and times, or stretch them to change their length" },
        ],
    },
    {
        title: "Review and Approve",
        items: [
            { icon: ClockIcon, bg: "bg-violet-100 dark:bg-violet-900/30", color: "text-violet-600 dark:text-violet-400", text: "Assignees move their own tasks along and hand them over in In Review" },
            { icon: BadgeCheckIcon, bg: "bg-rose-100 dark:bg-rose-900/30", color: "text-rose-600 dark:text-rose-400", text: "Reviewers, supervisors and admins approve work to Done or send it back" },
            { icon: GitPullRequestArrowIcon, bg: "bg-amber-100 dark:bg-amber-900/30", color: "text-amber-600 dark:text-amber-400", text: "Requested changes wait on the Requests page until an admin or supervisor decides" },
            { icon: BellIcon, bg: "bg-lime-100 dark:bg-lime-900/30", color: "text-lime-600 dark:text-lime-400", text: "Turn on push notifications to hear about reminders and decisions on your phone too" },
        ],
    },
    {
        title: "Track Progress with Analytics",
        items: [
            { icon: CalculatorIcon, bg: "bg-violet-100 dark:bg-violet-900/30", color: "text-violet-600 dark:text-violet-400", label: "Capacity Calculator:", text: "Calculate team sprint capacity based on availability" },
            { icon: TrendingUpIcon, bg: "bg-rose-100 dark:bg-rose-900/30", color: "text-rose-600 dark:text-rose-400", label: "Burndown Chart:", text: "Visualize sprint progress against the ideal burndown" },
            { icon: BarChartIcon, bg: "bg-amber-100 dark:bg-amber-900/30", color: "text-amber-600 dark:text-amber-400", label: "Velocity Tracker:", text: "Monitor team velocity across sprints" },
            { icon: FileTextIcon, bg: "bg-lime-100 dark:bg-lime-900/30", color: "text-lime-600 dark:text-lime-400", label: "Sprint Report Generator:", text: "Generate a Markdown report of the sprint" },
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
            "Add days off so routines and capacity skip them",
            "Give people the narrowest role that fits their work",
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
            "Set realistic due dates; give timed work a time block",
            "Move tasks to In Review when they're ready, not straight to Done",
            "Use filters and / search to focus on what matters now",
        ],
    },
];

const FOOTER_LINKS = [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
];

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
                            New: roles, change requests and bulk input
                        </Badge>
                    </div>
                    {/* The page's one h1 (CardTitle is a div) */}
                    <h1 className="text-4xl sm:text-5xl font-bold leading-tight tracking-tight text-foreground mb-6">
                        <HeadingReveal>Welcome to ScrumSpecter</HeadingReveal>
                    </h1>
                    <CardDescription className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed mb-8">
                        Sprint planning and task tracking for small agile teams. Plan the sprint, share out the work,
                        review it before it&apos;s done, and see how it went, all in one place.
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
                    <Stagger className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {FEATURES.map(({ icon: Icon, title, description, badge }) => (
                            <StaggerItem key={title} className="group flex flex-col items-center text-center space-y-4 p-6 rounded-card bg-card border border-border/70 shadow-soft hover:shadow-lift transition-shadow duration-300 ease-out relative">
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
                            </StaggerItem>
                        ))}
                    </Stagger>
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

            {/* Roles Section */}
            <Card className="border-0 shadow-xl bg-gradient-to-r from-primary/5 via-background to-primary/5">
                <FeaturedHeader
                    title="A Role for Everyone"
                    description="Each member gets exactly the access their work needs"
                />
                <CardContent className="p-10 pt-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                        {ROLES.map(({ icon: Icon, label, description }) => (
                            <div key={label} className="text-center space-y-3 group">
                                <div className="flex justify-center">
                                    <div className={cn("p-4 rounded-2xl", ICON_TILE)}>
                                        <Icon className="h-5 w-5 text-primary" />
                                    </div>
                                </div>
                                <div className="text-lg font-bold text-primary">{label}</div>
                                <div className="text-sm text-muted-foreground">{description}</div>
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
                        Create a free account, set up your workspace and invite your team in a few minutes
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
                    © {new Date().getFullYear()} ScrumSpecter. Built with Next.js 14, TypeScript, Tailwind CSS, and PostgreSQL.
                    Designed for small agile teams.
                </p>
                <div className="flex justify-center gap-6 text-xs text-muted-foreground">
                    {FOOTER_LINKS.map(({ label, href }) => (
                        <Link key={href} href={href} className="hover:text-foreground hover:underline">{label}</Link>
                    ))}
                </div>
            </div>
        </div>
    );
};
