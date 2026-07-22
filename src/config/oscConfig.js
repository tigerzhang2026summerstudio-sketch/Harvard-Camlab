/**
 * oscConfig.js — OSC-over-WebSocket input (the controller on WiFi → OSC).
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
 * PRIMARY PROTOCOL — raw MIDI over OSC. The controller sends the same
 * MIDI bytes it would over USB, wrapped in one OSC message:
 *
 *   /midi/raw  <status:int> <d1:int> <d2:int> <channel:int>
 *
 * where status/d1/d2/channel are the usual MIDI bytes (status is the
 * status byte, d1/d2 the two data bytes, channel the 0-based channel).
 * These flow through MidiManager.ingestOscMidi and are routed by the
 * SAME midiMap.js as USB MIDI — so notes → keys/pads, CCs → knobs,
 * pitch-bend → joystick, and MIDI-learn all work identically on WiFi.
 *
 * LEGACY SEMANTIC SCHEME — optional, for non-MIDI OSC senders:
 *   /pc/key   <note:int 0..127>  <vel:float 0..1>   (vel 0 = note off)
 *   /pc/knob  <index:int 0..7>   <value:float 0..1>
 *   /pc/pad   <bank:int 0=A 1=B> <index:int 0..7>   <vel:float 0..1>
 *   /pc/joy   <axis:int 0=x 1=y> <value:float -1..1>
 *
 * OSC types are flexible: ints or floats are accepted for every numeric
 * arg, and /pc/joy accepts "x"/"y" strings for the axis.
 */
export const oscConfig = {
  enabled: true,
  url: 'ws://localhost:8090',
  reconnectSec: 3,
  // When OSC is connected, silence the computer-keyboard fallback so
  // stray keypresses on the show laptop can't play notes.
  suppressKeyboardWhenLive: true,
  addresses: {
    midiRaw: '/midi/raw',   // primary — raw MIDI (status, d1, d2, channel)
    key: '/pc/key',         // legacy semantic scheme (optional)
    knob: '/pc/knob',
    pad: '/pc/pad',
    joy: '/pc/joy',
  },
};
