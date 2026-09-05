/**
 * Evaluate an expression inside the running app, over the DevTools protocol.
 *
 * The companion to read-app-console.mjs: that one listens, this one asks. Used
 * to measure the real thing — how many samples the store actually holds, how
 * long a selection takes — instead of reasoning about what it should be.
 *
 *   Resonance.exe --remote-debugging-port=9222
 *   node tools/eval-in-app.mjs "expression"
 */
const PORT = 9222;
const expression = process.argv.slice(2).join(' ');
if (!expression) {
  console.error('usage: node tools/eval-in-app.mjs "<expression>"');
  process.exit(2);
}

const targets = await fetch(`http://127.0.0.1:${PORT}/json`).then((r) => r.json());
const page = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
if (!page) {
  console.error('Aucune page. L’app tourne-t-elle avec --remote-debugging-port ?');
  process.exit(1);
}

const ws = new WebSocket(page.webSocketDebuggerUrl);
ws.addEventListener('open', () => {
  ws.send(
    JSON.stringify({
      id: 1,
      method: 'Runtime.evaluate',
      params: { expression, awaitPromise: true, returnByValue: true },
    })
  );
});

ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id !== 1) return;
  const result = msg.result;
  if (result?.exceptionDetails) {
    console.error(result.exceptionDetails.exception?.description ?? 'erreur');
    process.exit(1);
  }
  console.log(JSON.stringify(result?.result?.value ?? null, null, 1));
  ws.close();
  process.exit(0);
});

setTimeout(() => {
  console.error('délai dépassé');
  process.exit(1);
}, 30000);
