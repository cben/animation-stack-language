const Yeelight = require('yeelight2')

const lang = require('./lang')
const repl = require('./repl')

// Rooms in my home
// ----------------
// (TODO parametrize e.g. env vars?)
/*
var parents = new Yeelight('yeelink-light-color1_miio80914383.local')
var kids = new Yeelight('yeelink-light-color1_miio80916835.local')
var activity = new Yeelight('yeelink-light-color1_miio80919362.local')
var salon = new Yeelight('yeelink-light-color1_miio77486689.local')
*/

let lamp = null

let address = process.env['YEELIGHT']
if(address) {
  lamp = new Yeelight(address)
}
/*
  TODO:
  When control device wants to start music mode, it needs start a TCP
server firstly and then call “set_music” command to let the device know the IP and Port of the
TCP listen socket. After received the command, LED device will try to connect the specified
peer address. If the TCP connection can be established successfully, then control device could
send all supported commands through this channel without limit to simulate any music effect.
The control device can stop music mode by explicitly send a stop command or just by closing
the socket.

  lamp.set_music(1, host, port)
  */


const playColor = async (color, options) => {
  repl.playColor(color, options)
  if (lamp) {
    try {
      await lamp.set_rgb(color.red << 16 | color.green << 8 | color.blue)
    } catch(e) {
      console.log(e)
    }
  }
}

repl.repl([], {dictionary: lang.hebrewWords, playColor: playColor})
