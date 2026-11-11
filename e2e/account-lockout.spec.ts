import { expect, test } from "@playwright/test";

import { registerUser } from "./helpers";

// Every route that asks for the current password counts wrong guesses under the sign-in lockout (10, then 15 minutes), so a
// stolen session can't guess the password through changing the email or deleting the account, as well as changing the password.
const WRONG = 10;

test("changing the email: wrong passwords are counted, and after 10 even the right one is refused", async ({ baseURL }) => {
    const user = await registerUser(baseURL!, "Lock Lena");
    const change = (currentPassword: string) => user.api.patch("/api/account/profile", { data: { email: `new-${Date.now()}@example.test`, currentPassword } });
    for (let i = 0; i < WRONG; i++) expect((await change(`guess-${i}-password`)).status()).toBe(400);
    const locked = await change(user.password);
    expect(locked.status(), await locked.text()).toBe(429);
    expect(locked.headers()["content-type"]).toContain("json");
});

test("deleting the account: wrong passwords are counted, and after 10 even the right one is refused (the account stays)", async ({ baseURL }) => {
    const user = await registerUser(baseURL!, "Lock Lou");
    const remove = (password: string) => user.api.delete("/api/account", { data: { confirmEmail: user.email, password } });
    for (let i = 0; i < WRONG; i++) expect((await remove(`guess-${i}-password`)).status()).toBe(400);
    expect((await remove(user.password)).status()).toBe(429);
    expect((await user.api.get("/api/account")).status()).toBe(200);
});

test("the count is shared: guesses through the email change lock the password change too", async ({ baseURL }) => {
    const user = await registerUser(baseURL!, "Lock Lia");
    for (let i = 0; i < WRONG; i++) {
        expect((await user.api.patch("/api/account/profile", { data: { email: `x-${i}@example.test`, currentPassword: `guess-${i}-password` } })).status()).toBe(400);
    }
    const changed = await user.api.post("/api/account/password", { data: { currentPassword: user.password, newPassword: "a-brand-new-password" } });
    expect(changed.status(), await changed.text()).toBe(429);
});

test("a right password clears the count, so normal use is not locked", async ({ baseURL }) => {
    const user = await registerUser(baseURL!, "Lock Liv");
    for (let round = 0; round < 3; round++) {
        for (let i = 0; i < 5; i++) expect((await user.api.patch("/api/account/profile", { data: { email: `y-${round}-${i}@example.test`, currentPassword: "wrong-password-here" } })).status()).toBe(400);
        // Right password, same email: nothing to change, and the count starts over
        expect((await user.api.post("/api/account/password", { data: { currentPassword: user.password, newPassword: user.password } })).status()).toBeLessThan(500);
    }
});
