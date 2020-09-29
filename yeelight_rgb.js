// Put Yeelight RGB lamp into "music mode" where it connects back to a socket
// we listen on.  This allows us to send unlimited rate of commands.
// https://www.yeelight.com/en_US/developer

const net = require("net")

const CONTROL_PORT = 55443
const LISTEN_HOST = process.env["OUR_IP"] // TODO discover
const LISTEN_PORT = 30000 // whatever we want

let id = 0;
const command = (method, ...params) => {
  id++
  return JSON.stringify({ id: id, method: method, params: params }) + "\r\n"
}


var reverseSocket = null
var reverseServer = new net.Server()
reverseServer.on("connection", (s) => {
  console.log("reverseSocket connection")
  reverseSocket = s
  reverseSocket.setEncoding("ascii")
  reverseSocket.on("data", (d) => console.log("reverseSocket data:", d))
})
reverseServer.on("listening", () => console.log("reverseServer listening"))

var forwardSocket = new net.Socket()
reverseServer.on("listening", () => {
  forwardSocket.on("connect", () => {
    console.log("forwardSocket connect")
    forwardSocket.write(command("get_prop"))
    forwardSocket.write(command("set_music", 1, LISTEN_HOST, LISTEN_PORT))
  })
  forwardSocket.setEncoding("ascii")
  forwardSocket.on("data", (d) => console.log("forwardSocket data:", d))
  forwardSocket.connect({port: CONTROL_PORT, host: process.env["YEELIGHT_IP"]})
})

// TODO: chain those more elagantly using promises?
reverseServer.listen({port: LISTEN_PORT, host: LISTEN_HOST})

const playColor = async ({red, green, blue}) => {
  if(reverseSocket == null) {
    return
  }
  // "rgb_value"is the target color, whose type is integer. It should be expressed in decimal integer ranges from 0 to 16777215 (hex: 0xFFFFFF).
  // RGB = (R*65536) + (G*256) + B
  const rgb = red << 16 | green << 8 | blue
  // apparently, the lamp normalizes RGB to desired brightness
  const bright = (red + green + blue) / (3 * 255.0) * 100
  //console.log(red, green, blue, rgb, bright)
  await new Promise(resolve => {
    // "effect" support two values: "sudden" and "smooth". If effect is "sudden", then the color temperature will be changed directly to target value, under this case, the third parameter "duration" is ignored. If effect is "smooth", then the color temperature will be changed to target value in a gradual fashion, under this case, the total time of gradual change is specified in third parameter "duration"
    // "duration" specifies the total time of the gradual changing. The unit is milliseconds. The minimum support duration is 30 milliseconds.
    reverseSocket.write(command("set_rgb", rgb, "sudden", 0), resolve)
  })
  await new Promise(resolve => {
    reverseSocket.write(command("set_bright", bright, "sudden", 50), resolve)
  })
}

const sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms)
})

// Calls `color` function with time in [0...duration] range, function
// should return {red, green, blue} struct.
const playAnim = async ({color, duration}) => {
  var ms0 = Date.now()
  while(true) {
    var t = (Date.now() - ms0) * 0.001
    //console.log(t)
    if(t > duration) {
      await playColor(color(duration))
      break
    }
    await playColor(color(t))
    //await sleep(0.001)
  }
}

module.exports = {
  forwardSocket,
  reverseSocket,
  command,
  playColor,
  playAnim,
}

/*
var y = require('./yeelight_rgb')
var a = {duration: 1, color: (t) => ({red: t*255, green: (1-t)*255, blue: 0})}
var lang = require('./lang')
y.playAnim(a).then(console.log)
*/
