// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: integrations/max-for-live/heady_sysex_receiver.js                                                    ║
// ║  LAYER: root                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
autowatch = 1;
outlets = 1;

var masterSong = new LiveAPI('live_set');
var HEADY_ID = 125;

function sysex() {
    var sysExData = arrayfromargs(arguments);

    if (sysExData[0] === 240 && sysExData[1] === HEADY_ID) {
        var commandId = sysExData[2];

        if (commandId === 1) {
            var msb = sysExData[3];
            var lsb = sysExData[4];
            var newTempo = (msb * 128) + lsb;
            post('HeadyAI Command Received: Setting Tempo to ' + newTempo + '\n');
            masterSong.set('tempo', newTempo);
        }
    }
}
