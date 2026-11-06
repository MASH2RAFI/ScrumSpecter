// TCP proxy that delays every chunk, to mimic a far-away database: node latency-proxy.mjs <listen> <target> <delayMs each way>
import net from "node:net";
const [listen, target, delay] = process.argv.slice(2).map(Number);
net.createServer((client) => {
    const upstream = net.connect(target, "127.0.0.1");
    const client0 = client;
    const pipe = (from, to) => {
        const queue = [];
        let closed = false;
        from.on("data", (chunk) => { if (process.env.LOG && from === client0) console.log(Date.now(), chunk.length); setTimeout(() => !closed && to.write(chunk), delay); });
        from.on("close", () => { closed = true; setTimeout(() => to.end(), delay); });
        from.on("error", () => to.destroy());
    };
    pipe(client, upstream);
    pipe(upstream, client);
}).listen(listen, "127.0.0.1", () => console.log(`proxy ${listen} -> ${target} (+${delay} ms each way)`));
