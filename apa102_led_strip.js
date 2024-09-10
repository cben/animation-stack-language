// Raspberry Pi with a led strip connected to hardware SPI pins
// There seem to be 3 ways to use SPI:
// - /dev/gpiomem - software bit banging (slow), enough to be in `gpio` group
// - /dev/mem - fast hardware SPI, requires root
// - /dev/spidevX.X - fast hardware SPI, enough to be in `spi` group (raspbian)
//
// You need spi-bcm2708 kernel module.
// On raspbian `sudo raspi-config` -> Interfacing -> enable SPI.

const piSPI = require('pi-spi')

const spi = piSPI.initialize("/dev/spidev0.0")
// People say 4MHz and more work fine, Pi supports powers of two up to 32MHz.
spi.clockSpeed(1e6)

const NLEDS = 150  // strip length, TODO make configurable

// Inspired by https://github.com/livejs/pixels-apa102 but don't want
// to mess with ndpixels and `cwise` which does heavy voodoo.
//
// I'm keeping a buffer in a format good for the led strip, and
// changing a pixel mutates this buffer directly.

// https://cpldcpu.wordpress.com/2014/08/27/apa102/
// https://cpldcpu.wordpress.com/2014/11/30/understanding-the-apa102-superled/

// TODO: in theory, end frame of ceil((NLEDS-1) / 16) should be enough.
// but I saw some artifacts, let's try more?  (Or was this just brigtness flicker?)
let buf = Buffer.alloc(/*start*/1 + /*pixels*/4 * NLEDS + /*end*/Math.ceil(NLEDS))

let reverse = process.env.LEDS_REVERSE === 'true'

// r, g, b, brightness ∈ [0..255]
//
// The r,g,b values are PWM'd at high frequncy ~19.2kHz.  Brightness modulation
// is overlaid on top of that, at ~32 times slower PWM ~582Hz.
// So it's best to stick to max brightness, except for extending dynamic
// range towards blacks...
const setRGBb = (pixel, r, g, b, brightness) => { 
  if (pixel < 0 || pixel > NLEDS) {
    throw(`setRGBb: pixel ${pixel} out of bounds [0..${NLEDS})`)
  }
  const i = 1 + 4 * (reverse ? NLEDS - 1 - pixel : pixel)
  buf[i] = 0xE0 | (brightness >> 3)  // 111bbbbb
  buf[i + 1] = b
  buf[i + 2] = g
  buf[i + 3] = r
}

const clear = () => {
  for(let i = 0; i < NLEDS; i++) {
    setRGBb(i, 0, 0, 0, 0)
  }
}

// after start frame, all pixels must have MSB turned on
clear()

const send = () => {
  //console.log(buf)
  return new Promise(resolve => spi.write(buf, resolve))
}

module.exports = {NLEDS, clear, setRGBb, send, buf, spi} // buf, spi only for debug 
