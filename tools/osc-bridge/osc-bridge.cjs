#!/usr/bin/env node
/**
 * painted-cave OSC bridge — the missing link a browser needs.
 *
 * A browser cannot receive OSC/UDP off the WiFi, so this relay runs on
 * the SHOW LAPTOP: it listens for OSC/UDP from whatever sends it on the
 * network and forwards every packet, untouched, to the browser over a
 * WebSocket. Zero dependencies — runs on the bundled Node:
 *
 *   tools/node-v22.17.0-darwin-arm64/bin/node tools/osc-bridge/osc-bridge.cjs
 *
 * Ports (override with env vars OSC_UDP_PORT / OSC_WS_PORT):
 *   OSC/UDP in : 9000   ← point your WiFi OSC sender at THIS laptop:9000
 *   WebSocket  : 8090   ← the browser connects to ws://localhost:8090
 *
 * The browser's WebSocket URL is set in src/config/oscConfig.js.
 */
const http = require('http');
const crypto = require('crypto');
const dgram = require('dgram');
const os = require('os');

const UDP_PORT = Number(process.env.OSC_UDP_PORT || 9000);
const WS_PORT = Number(process.env.OSC_WS_PORT || 8090);
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

const clients = new Set();

// ── Zero-dep WebSocket server (browser side) ──────────────────────────
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end(`painted-cave osc-bridge · OSC/UDP :${UDP_PORT} → WebSocket :${WS_PORT}\n`);
});

server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n'
    + 'Upgrade: websocket\r\n'
    + 'Connection: Upgrade\r\n'
    + `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
  );
  clients.add(socket);
  console.log(`[bridge] browser connected (${clients.size})`);
  socket.on('data', (buf) => {           // only watch for the close frame
    if (buf.length >= 2 && (buf[0] & 0x0f) === 0x8) socket.end();
  });
  const drop = () => {
    if (clients.delete(socket)) console.log(`[bridge] browser left (${clients.size})`);
  };
  socket.on('close', drop);
  socket.on('error', drop);
});

/** One unmasked binary WebSocket frame carrying the raw OSC packet. */
function frame(payload) {
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.from([0x82, len]);
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x82; header[1] = 126; header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x82; header[1] = 127; header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

// ── OSC/UDP in → forward to every connected browser ───────────────────
const udp = dgram.createSocket('udp4');
udp.on('message', (msg) => {
  if (!clients.size) return;
  const f = frame(msg);
  for (const c of clients) { try { c.write(f); } catch { /* dropped */ } }
});
udp.on('error', (e) => console.error('[bridge] udp error:', e.message));

udp.bind(UDP_PORT, () => {
  server.listen(WS_PORT, () => {
    console.log('── painted-cave OSC bridge ──────────────────────────');
    console.log(`  OSC/UDP in : port ${UDP_PORT}`);
    console.log(`  WebSocket  : ws://localhost:${WS_PORT}  (the browser connects here)`);
    console.log('  Point your WiFi OSC sender at THIS laptop:');
    let found = false;
    for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
      for (const a of addrs || []) {
        if (a.family === 'IPv4' && !a.internal) {
          console.log(`    ${a.address}:${UDP_PORT}   (${name})`);
          found = true;
        }
      }
    }
    if (!found) console.log('    (no LAN IPv4 found — is WiFi on?)');
    console.log('  Scheme: /pc/key /pc/knob /pc/pad /pc/joy  (see src/config/oscConfig.js)');
    console.log('─────────────────────────────────────────────────────');
  });
});
