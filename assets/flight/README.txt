assets/flight/ — source stills for the intro flight's photo point clouds.

Served at /flight/<name> in dev and in the built bundle (this whole
assets/ tree is the vite publicDir).

Drop the shot list here as 01_clouds.jpg … 12_c217_ceiling.jpg (see the
intro-flight build spec, Appendix A). Optional depth maps sit beside
each image as <name>_depth.png (white = near); without one, a
procedural bottom=near approximation runs automatically and logs so.

Stations are wired in src/config/config.js → intro.stations. A missing
file never breaks the flight — the procedural particle world simply
shows through.
