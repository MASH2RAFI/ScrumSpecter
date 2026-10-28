import "server-only";

// Transactional email through Resend's REST API. Without RESEND_API_KEY (local development) the
// message is logged instead, so flows like "forgot password" can still be tried.
export const sendEmail = async ({ to, subject, text }: { to: string; subject: string; text: string }) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        console.log(`[email not configured] To: ${to}\nSubject: ${subject}\n\n${text}`);
        return false;
    }

    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
            from: process.env.EMAIL_FROM || "ScrumSpecter <onboarding@resend.dev>",
            to,
            subject,
            text,
        }),
        signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
        console.error("Email failed", response.status, await response.text().catch(() => ""));
    }
    return response.ok;
};
