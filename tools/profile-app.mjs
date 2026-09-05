/**
 * Profile the running app while it does one thing, over the DevTools protocol.
 *
 * eval-in-app.mjs times what you already suspect. This one says where the time
 * actually went — which mattered here, because the four things the plan
 * suspected added up to 760 ms of a 4 200 ms freeze.
 *
 *   Resonance.exe --remote-debugging-port=9222
 *   node tools/profile-app.mjs "<expression to profile>"
 */
const PORT = 9222;
const expression = process.argv.slice(2).join(' ');
if (!expression) {
  console.error('usage: node tools/profile-app.mjs "<expression>"');
  process.exit(2);
}

const targets = await fetch(`http://127.0.0.1:${PORT}/json`).then((r) => r.json());
const page = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
if (!page) {
  console.error('Aucune page. L’app tourne-t-elle avec --remote-debugging-port ?');
  process.exit(1);
}

const ws = new WebSocket(page.webSocketDebuggerUrl);
let nextId = 1;
const waiting = new Map();

const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = nextId++;
    waiting.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });

ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data);
  const pending = waiting.get(msg.id);
  if (!pending) return;
  waiting.delete(msg.id);
  if (msg.error) pending.reject(new Error(msg.error.message));
  else pending.resolve(msg.result);
});

await new Promise((resolve) => ws.addEventListener('open', resolve));

await send('Profiler.enable');
// 100 µs: fine enough to separate a decode from a re-render, coarse enough
// that the profiler itself is not what we end up measuring.
await send('Profiler.setSamplingInterval', { interval: 100 });
await send('Profiler.start');

const run = await send('Runtime.evaluate', {
  expression,
  awaitPromise: true,
  returnByValue: true,
});

const { profile } = await send('Profiler.stop');

if (run.exceptionDetails) {
  console.error(run.exceptionDetails.exception?.description ?? 'erreur');
}

/** Self time per node, from the sample counts the profiler hands back. */
const selfTime = new Map();
const total = profile.samples?.length ?? 0;
const spanMs = (profile.endTime - profile.startTime) / 1000;
const msPerSample = total ? spanMs / total : 0;

for (const id of profile.samples ?? []) {
  selfTime.set(id, (selfTime.get(id) ?? 0) + 1);
}

const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const rows = [...selfTime.entries()]
  .map(([id, count]) => {
    const frame = byId.get(id)?.callFrame ?? {};
    const where = frame.url ? `${frame.url.split('/').pop()}:${frame.lineNumber + 1}` : '';
    return {
      ms: Math.round(count * msPerSample),
      name: frame.functionName || '(anonyme)',
      where,
    };
  })
  .filter((r) => r.ms >= 1)
  .sort((a, b) => b.ms - a.ms)
  .slice(0, 25);

console.log(`durée profilée : ${Math.round(spanMs)} ms, ${total} échantillons\n`);
for (const r of rows) {
  console.log(`${String(r.ms).padStart(6)} ms  ${r.name}  ${r.where}`);
}
console.log('\nvaleur retournée :', JSON.stringify(run.result?.value ?? null));

ws.close();
process.exit(0);
