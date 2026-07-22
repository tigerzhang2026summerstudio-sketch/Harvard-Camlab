/**
 * oscConfig.js — OSC-over-WebSocket input (keyboard on WiFi → OSC).
 *
 * A browser cannot receive raw OSC/UDP off the network, so a small relay
 * (tools/osc-bridge) runs on the show laptop: it receives OSC/UDP from
 * whatever sends it on the WiFi and forwards each packet to the browser
 * over a WebSocket. The browser connects to that relay here.
 *
 *   url — the relay's WebSocket. For the relay running on the SAME
 *         laptop as the browser, localhost. Across the internet, point
 *         this at your public relay instead (wss://your-host:port).
 *
 * The address scheme the sender must use (args after the address):
 *   /pc/key   <note:int 0..127>  <vel:float 0..1>   (vel 0 = note off)
 *   /pc/knob  <index:int 0..7>   <value:float 0..1>
 *   /pc/pad   <bank:int 0=A 1=B> <index:int 0..7>   <vel:float 0..1>
 *   /pc/joy   <axis:int 0=x 1=y> <value:float -1..1>
 *
 * OSC types are flexible: ints or floats are both accepted for every
 * numeric arg, and /pc/joy accepts "x"/"y" strings for the axis.
 */
export const oscConfig = {
  enabled: true,
  url: 'ws://localhost:8090',
  reconnectSec: 3,
  // When OSC is connected, silence the computer-keyboard fallback so
  // stray keypresses on the show laptop can't play notes.
  suppressKeyboardWhenLive: true,
  addresses: {
    key: '/pc/key',
    knob: '/pc/knob',
    pad: '/pc/pad',
    joy: '/pc/joy',
  },
};
