/**
 * Read the running app's console over the Chrome DevTools Protocol.
 *
 * The ingest already reports where its time goes — decode, analyse, encode —
 * once per batch. Rather than guess which stage to parallelise, this listens
 * to the real thing running over real files.
 *
 *   Resonance.exe --remote-debugging-port=9222
 *   node tools/read-app-console.mjs [seconds] [regex]
 */
const PORT = 9222;
const seconds = Number(process.argv[2] ?? 90);
const filter = process.argv[3] ? new RegExp(process.argv[3], 'i') : null;

const targets = await fetch(`http://127.0.0.1:${PORT}/json`).then((r) => r.json());
// The renderer is the page target; the others are workers and extensions.
const page = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
if (!page) {
  console.error('Aucune page à écouter. L’app tourne-t-elle avec --remote-debugging-port ?');
  process.exit(1);
}

const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const send = (method, params = {}) => ws.send(JSON.stringify({ id: ++id, method, params }));

ws.addEventListener('open', () => {
  send('Runtime.enable');
  send('Log.enable');
  console.error(`écoute ${seconds}s sur « ${page.title} »…`);
});

const say = (text) => {
  if (!filter || filter.test(text)) console.log(text);
};

ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data);
  if (msg.method === 'Runtime.consoleAPICalled') {
    say(msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
  } else if (msg.method === 'Log.entryAdded') {
    say(msg.params.entry.text);
  }
});

setTimeout(() => {
  ws.close();
  process.exit(0);
}, seconds * 1000);
