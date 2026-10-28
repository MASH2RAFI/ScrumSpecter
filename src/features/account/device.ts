// "Chrome on Windows" from a user agent, for the signed-in devices list. Deliberately small:
// it only needs to help people recognise their own devices.

const BROWSERS: [RegExp, string][] = [
    [/Edg(e|A|iOS)?\//, "Edge"],
    [/OPR\/|Opera/, "Opera"],
    [/SamsungBrowser\//, "Samsung Internet"],
    [/Firefox\/|FxiOS\//, "Firefox"],
    [/Chrome\/|CriOS\//, "Chrome"],
    [/Safari\//, "Safari"],
];

const SYSTEMS: [RegExp, string][] = [
    [/iPhone/, "iPhone"],
    [/iPad/, "iPad"],
    [/Android/, "Android"],
    [/CrOS/, "ChromeOS"],
    [/Windows/, "Windows"],
    [/Mac OS X|Macintosh/, "macOS"],
    [/Linux/, "Linux"],
];

export type DeviceKind = "phone" | "tablet" | "desktop";

export const describeDevice = (userAgent: string | null | undefined) => {
    if (!userAgent) {
        return { label: "Unknown device", kind: "desktop" as DeviceKind };
    }
    const browser = BROWSERS.find(([pattern]) => pattern.test(userAgent))?.[1];
    const system = SYSTEMS.find(([pattern]) => pattern.test(userAgent))?.[1];
    const kind: DeviceKind = /iPad|Tablet/.test(userAgent)
        ? "tablet"
        : /Mobi|iPhone|Android/.test(userAgent) ? "phone" : "desktop";

    const label = browser && system ? `${browser} on ${system}` : browser ?? system ?? "Unknown device";
    return { label, kind };
};
