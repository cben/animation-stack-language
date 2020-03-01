// Put Yeelight RGB lamp into "music mode" where it connects back to a socket
// we listen on.  This allows us to send unlimited rate of commands.
// https://www.yeelight.com/en_US/developer

const net = require("net")

const CONTROL_PORT = 55443
const LISTEN_HOST = process.env["OUR_IP"] // TODO discover
const LISTEN_PORT = 30000 // whatever we want

const command = (method, ...params) =>
      JSON.stringify({id: 0, method: method, params: params}) + "\r\n"

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
  const rgb = red << 16 | green << 8 | blue
  await reverseSocket.write(command("set_rgb", rgb, "smooth", 1)) // 1ms probably ignored?
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
      break
    }
    await playColor(anim.color(t))
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
