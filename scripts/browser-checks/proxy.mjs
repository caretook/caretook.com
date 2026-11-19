// A forward proxy that can be switched off, to cut one browser's network
// (page and workers alike) the way losing Wi-Fi would.
//
// Chrome sends WebSockets through a proxy as CONNECT tunnels, even ws://, so
// the proxy tunnels CONNECT too. Without that, Vite's HMR socket never
// connected in a proxied browser: the page never heard "optimized dependencies
// changed, reloading", kept its old pre-bundled chunks while newly loaded
// routes imported the new ones, and broke with two copies of React and Yjs
// ("Invalid hook call", a blank page; B-27).
//
// Vite's own sockets (protocols `vite-hmr` and `vite-ping`) are dev tooling,
// not the app's network, so going offline leaves them open: cutting them
// would make Vite reload the page when it reconnects, which no real device
// does.
import http from "node:http";
import net from "node:net";

export function startProxy(basePort) {
  // Parallel loops shift every CDP and proxy port by CDP_PORT_OFFSET (see cdp.mjs).
  const port = basePort + Number(process.env.CDP_PORT_OFFSET ?? 0);
  let online = true;
  const sockets = new Set();
  const server = http.createServer((req, res) => {
    if (!online) return req.socket.destroy();
    const url = new URL(req.url);
    const upstream = http.request(
      {
        host: url.hostname,
        port: url.port || 80,
        path: url.pathname + url.search,
        method: req.method,
        headers: req.headers,
      },
      (up) => {
        res.writeHead(up.statusCode, up.headers);
        up.pipe(res);
      },
    );
    upstream.on("error", () => res.destroy());
    req.pipe(upstream);
  });
  server.on("connection", (s) => {
    if (!online) return s.destroy();
    sockets.add(s);
    s.on("close", () => sockets.delete(s));
  });
  server.on("connect", (req, socket, head) => {
    if (!online) return socket.destroy();
    const [host, port] = req.url.split(":");
    // A tunnel is Vite's when its first request asks for a vite- protocol.
    socket.once("data", (chunk) => {
      if (/^sec-websocket-protocol:\s*vite-/im.test(chunk.toString("latin1"))) {
        sockets.delete(socket);
        sockets.delete(up);
      }
    });
    const up = net.connect(Number(port) || 443, host, () => {
      socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if (head.length) up.write(head);
      socket.pipe(up).pipe(socket);
    });
    sockets.add(up);
    up.on("close", () => sockets.delete(up));
    up.on("error", () => socket.destroy());
    socket.on("error", () => up.destroy());
  });
  server.on("upgrade", (req, socket, head) => {
    if (!online) return socket.destroy();
    const url = new URL(req.url);
    const up = net.connect(url.port || 80, url.hostname, () => {
      up.write(
        `${req.method} ${url.pathname}${url.search} HTTP/1.1\r\n` +
          Object.entries(req.headers)
            .map(([k, v]) => `${k}: ${v}`)
            .join("\r\n") +
          "\r\n\r\n",
      );
      up.write(head);
      socket.pipe(up).pipe(socket);
    });
    sockets.add(up);
    up.on("close", () => sockets.delete(up));
    up.on("error", () => socket.destroy());
  });
  server.listen(port, "127.0.0.1");
  return {
    args: [`--proxy-server=http://127.0.0.1:${port}`, "--proxy-bypass-list=<-loopback>"],
    setOnline(on) {
      online = on;
      if (!on) for (const s of sockets) s.destroy();
    },
    close: () => server.close(),
  };
}
