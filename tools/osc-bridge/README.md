# OSC bridge

The keyboard/controller sends **OSC over WiFi**, but a browser can't
receive OSC/UDP directly. This tiny relay runs on the **show laptop**:
it receives OSC/UDP from the network and forwards each packet to the
browser over a WebSocket. Zero dependencies — runs on the Node bundled
in `tools/`.

## Run it

From the project root, on the show laptop:

```bash
tools/node-v22.17.0-darwin-arm64/bin/node tools/osc-bridge/osc-bridge.cjs
```

It prints the laptop's LAN IP addresses — point your OSC sender at
`THAT-IP:9000`. Leave it running during the show.

- **OSC/UDP in:** port `9000`  ← your WiFi sender targets this
- **WebSocket out:** port `8090`  ← the browser connects to `ws://localhost:8090`

Override ports with env vars if needed:
`OSC_UDP_PORT=9000 OSC_WS_PORT=8090 node …/osc-bridge.cjs`

The browser's WebSocket URL lives in `src/config/oscConfig.js` (default
`ws://localhost:8090`, since the bridge runs on the same laptop as the
browser). For a sender/Cave on **different networks**, host this relay
somewhere public and set that URL to your `wss://…` instead.

## What to send (address scheme)

Any OSC source works as long as it sends these addresses:

| Address     | Args                                   | Meaning |
|-------------|----------------------------------------|---------|
| `/pc/key`   | `note` (int 0–127), `vel` (float 0–1)  | a key strike; `vel 0` = note off |
| `/pc/knob`  | `index` (int 0–7), `value` (float 0–1) | dial K1–K8 |
| `/pc/pad`   | `bank` (int 0=A / 1=B), `index` (int 0–7), `vel` (float 0–1) | a pad |
| `/pc/joy`   | `axis` (int 0=x / 1=y), `value` (float −1–1) | joystick / bird steering |

Ints or floats are both accepted for numeric args; `/pc/joy` also
accepts the strings `"x"`/`"y"` for the axis. Bundles and plain
messages both decode.

## Chain

```
controller on WiFi ──OSC/UDP──▶ osc-bridge (show laptop) ──WebSocket──▶ browser
                    :9000                                  :8090
```

MIDI (USB) and the computer-keyboard fallback still work alongside OSC;
when OSC connects, the keyboard fallback is silenced so stray keypresses
on the laptop can't play notes (`suppressKeyboardWhenLive` in the config).
