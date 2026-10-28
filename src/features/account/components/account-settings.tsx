"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { parseAsStringEnum, useQueryState } from "nuqs";
import { FcGoogle } from "react-icons/fc";
import { usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { UserPreferences } from "@/features/auth/preferences";

import {
    type AccountInfo,
    useChangePassword,
    useDeleteAccount,
    useGetAccount,
    useRevokeOtherSessions,
    useUnlinkGoogle,
    useUpdatePreferences,
    useUpdateProfile,
} from "../api/use-account";
import { ACCOUNT_TABS, type AccountTab } from "../account-tabs";
import { DeviceList } from "./device-list";
import { FormSkeleton } from "@/components/page-skeletons";

// The account page (/account): profile, security and display preferences.
// Notification settings are separate (bell → Settings).
export const AccountSettings = () => {
    const [tab, setTab] = useQueryState("tab", parseAsStringEnum<AccountTab>([...ACCOUNT_TABS]).withDefault("profile"));
    const searchParams = useSearchParams();

    // Back from Google's account linking (see /api/auth/google/callback)
    const googleResult = searchParams.get("google");
    useEffect(() => {
        if (googleResult === "linked") toast.success("Google sign-in linked");
        if (googleResult === "in_use") toast.error("That Google account is already linked to another user");
    }, [googleResult]);

    return (
        <div className="w-full max-w-2xl space-y-6">
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" asChild>
                    <Link href="/">
                        <ArrowLeftIcon className="mr-1 size-4" />
                        Back
                    </Link>
                </Button>
                <h1 className="text-2xl font-bold">Account settings</h1>
            </div>
            <Tabs value={tab} onValueChange={(value) => setTab(value as AccountTab)}>
                <TabsList className="w-full">
                    {ACCOUNT_TABS.map((value) => (
                        <TabsTrigger key={value} value={value} className="flex-1 capitalize">{value}</TabsTrigger>
                    ))}
                </TabsList>
                <AccountTabs />
            </Tabs>
        </div>
    );
};

const AccountTabs = () => {
    const { data: account, isLoading } = useGetAccount();

    if (isLoading || !account) {
        return (
            <FormSkeleton fields={3} className="p-0" />
        );
    }

    return (
        <>
            <TabsContent value="profile"><ProfileTab account={account} /></TabsContent>
            <TabsContent value="security"><SecurityTab account={account} /></TabsContent>
            <TabsContent value="preferences"><PreferencesTab preferences={account.preferences} /></TabsContent>
        </>
    );
};

const Section = ({ title, description, children }: { title: string; description?: string; children: ReactNode }) => (
    <section className="space-y-3 rounded-lg border p-4">
        <div>
            <h3 className="font-semibold">{title}</h3>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {children}
    </section>
);

const Field = ({ id, label, ...props }: { id: string; label: string } & React.ComponentProps<typeof Input>) => (
    <div className="space-y-1.5">
        <Label htmlFor={id}>{label}</Label>
        <Input id={id} {...props} />
    </div>
);

const ProfileTab = ({ account }: { account: AccountInfo }) => {
    const [name, setName] = useState(account.name);
    const [email, setEmail] = useState(account.email);
    const [currentPassword, setCurrentPassword] = useState("");
    const { mutate, isPending } = useUpdateProfile();
    const emailChanged = email.trim().toLowerCase() !== account.email;

    const submit = (event: FormEvent) => {
        event.preventDefault();
        mutate(
            { name: name.trim(), ...(emailChanged ? { email: email.trim(), currentPassword } : {}) },
            { onSuccess: () => setCurrentPassword("") },
        );
    };

    return (
        <form onSubmit={submit} className="space-y-4 pt-2">
            <Field id="account-name" label="Name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
            <Field
                id="account-email"
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={!account.hasPassword}
                required
            />
            {!account.hasPassword && (
                <p className="text-xs text-muted-foreground">Set a password under Security to change your email.</p>
            )}
            {emailChanged && (
                <Field
                    id="account-email-password"
                    label="Current password"
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                />
            )}
            <div className="flex justify-end">
                <Button type="submit" disabled={isPending || (name.trim() === account.name && !emailChanged)}>Save profile</Button>
            </div>
        </form>
    );
};

const SecurityTab = ({ account }: { account: AccountInfo }) => {
    const pathname = usePathname();
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmEmail, setConfirmEmail] = useState("");
    const [deletePassword, setDeletePassword] = useState("");
    const changePassword = useChangePassword();
    const revokeOthers = useRevokeOtherSessions();
    const unlinkGoogle = useUnlinkGoogle();
    const deleteAccount = useDeleteAccount();
    const otherSessions = Math.max(account.activeSessions - 1, 0);

    const savePassword = (event: FormEvent) => {
        event.preventDefault();
        changePassword.mutate(
            { newPassword, ...(account.hasPassword ? { currentPassword } : {}) },
            { onSuccess: () => { setCurrentPassword(""); setNewPassword(""); } },
        );
    };

    const removeAccount = (event: FormEvent) => {
        event.preventDefault();
        deleteAccount.mutate({ confirmEmail, ...(account.hasPassword ? { password: deletePassword } : {}) });
    };

    return (
        <div className="space-y-4 pt-2">
            <Section
                title={account.hasPassword ? "Change password" : "Set a password"}
                description={account.hasPassword ? "Other devices are signed out when you change it." : "Lets you sign in with your email as well as Google."}
            >
                <form onSubmit={savePassword} className="space-y-3">
                    {account.hasPassword && (
                        <Field id="current-password" label="Current password" type="password" autoComplete="current-password"
                            value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
                    )}
                    <Field id="new-password" label="New password" type="password" autoComplete="new-password" minLength={8}
                        value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                    <div className="flex justify-end">
                        <Button type="submit" disabled={changePassword.isPending}>{account.hasPassword ? "Change password" : "Set password"}</Button>
                    </div>
                </form>
            </Section>

            <Section
                title="Signed-in devices"
                description={otherSessions ? `You're signed in on ${otherSessions + 1} devices.` : "Only this device is signed in."}
            >
                <DeviceList />
                {otherSessions > 1 && (
                    <Button variant="outline" disabled={revokeOthers.isPending} onClick={() => revokeOthers.mutate(undefined)}>
                        Sign out all other devices
                    </Button>
                )}
            </Section>

            {(account.googleEnabled || account.googleLinked) && (
                <Section title="Google sign-in" description={account.googleLinked ? "You can sign in with Google." : "Not linked."}>
                    {account.googleLinked ? (
                        <Button variant="outline" disabled={unlinkGoogle.isPending} onClick={() => unlinkGoogle.mutate(undefined)}>
                            Unlink Google
                        </Button>
                    ) : (
                        <Button variant="outline" asChild>
                            <a href={`/api/auth/google?link=1&returnTo=${encodeURIComponent(pathname)}`}>
                                <FcGoogle className="mr-2 size-4" />
                                Link Google account
                            </a>
                        </Button>
                    )}
                    {account.googleLinked && !account.hasPassword && (
                        <p className="text-xs text-muted-foreground">Set a password before unlinking, or you won&apos;t be able to sign in.</p>
                    )}
                </Section>
            )}

            <Section title="Delete account" description="Removes your account and the workspaces only you are in. Shared workspaces keep your tasks, handed to another admin.">
                <form onSubmit={removeAccount} className="space-y-3">
                    <Field id="delete-confirm-email" label={`Type ${account.email} to confirm`} value={confirmEmail}
                        onChange={(e) => setConfirmEmail(e.target.value)} autoComplete="off" required />
                    {account.hasPassword && (
                        <Field id="delete-password" label="Password" type="password" autoComplete="current-password"
                            value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} required />
                    )}
                    <div className="flex justify-end">
                        <Button
                            type="submit"
                            variant="destructive"
                            disabled={deleteAccount.isPending || confirmEmail.trim().toLowerCase() !== account.email}
                        >
                            Delete my account
                        </Button>
                    </div>
                </form>
            </Section>
        </div>
    );
};

const PreferencesTab = ({ preferences }: { preferences: UserPreferences }) => {
    const { mutate, isPending } = useUpdatePreferences();

    const row = <K extends keyof UserPreferences>(
        key: K,
        label: string,
        options: { value: UserPreferences[K]; label: string }[],
    ) => (
        <div className="flex items-center justify-between gap-4">
            <Label htmlFor={`pref-${key}`}>{label}</Label>
            <Select
                value={String(preferences[key])}
                disabled={isPending}
                onValueChange={(value) => {
                    const option = options.find((o) => String(o.value) === value);
                    if (option) mutate({ [key]: option.value } as Partial<UserPreferences>);
                }}
            >
                <SelectTrigger id={`pref-${key}`} className="w-40">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {options.map((option) => (
                        <SelectItem key={String(option.value)} value={String(option.value)}>{option.label}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );

    return (
        <div className="space-y-4 pt-2">
            <Section title="Display" description="Saved to your account, so they follow you to other devices.">
                {row("defaultTaskView", "Default task view", [
                    { value: "table", label: "Table" },
                    { value: "kanban", label: "Kanban" },
                    { value: "calendar", label: "Calendar" },
                ])}
                {row("weekStart", "Week starts on", [
                    { value: 6, label: "Saturday" },
                    { value: 0, label: "Sunday" },
                    { value: 1, label: "Monday" },
                ])}
                {row("timeFormat", "Time format", [
                    { value: "12h", label: "12-hour (2:30 PM)" },
                    { value: "24h", label: "24-hour (14:30)" },
                ])}
            </Section>
        </div>
    );
};
