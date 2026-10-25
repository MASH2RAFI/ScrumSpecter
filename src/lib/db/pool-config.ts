import tls from "tls";
import net from "net";
import type { PoolConfig } from "pg";

// DATABASE_SSL:
//   "false"  plain TCP (local dev only)
//   "direct" TLS from the first byte (Postgres 17 sslnegotiation=direct). Needed through
//            Tailscale Funnel, which routes by SNI and drops Postgres' plaintext SSLRequest.
//   default  normal Postgres TLS upgrade (tailnet / localhost)
// The server certificate is self-signed, so it is not verified.
export const poolConfig = (connectionString: string): PoolConfig => {
    const mode = process.env.DATABASE_SSL;

    if (mode === "false") {
        return { connectionString, ssl: false };
    }

    if (mode !== "direct") {
        return { connectionString, ssl: { rejectUnauthorized: false } };
    }

    const servername = new URL(connectionString).hostname;

    return {
        connectionString,
        // pg speaks plaintext protocol over this already-encrypted socket
        ssl: false,
        stream: () => {
            const raw = new net.Socket();
            const socket = tls.connect({
                socket: raw,
                servername,
                ALPNProtocols: ["postgresql"],
                rejectUnauthorized: false,
            });

            // pg calls connect(port, host) itself and waits for "connect"
            socket.connect = ((port: number, host: string) => {
                raw.connect(port, host);
                return socket;
            }) as typeof socket.connect;
            socket.once("secureConnect", () => socket.emit("connect"));

            return socket;
        },
    };
};
