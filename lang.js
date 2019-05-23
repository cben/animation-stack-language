// Color helpers
// -------------
// {red, green, blue} using 0..255 interval
// TODO 255 not friendly to kids, probably want 0..100 range, but what's best internal representation?

// TODO there is probably an npm module doing all this better

const COLOR_MAX = 255
const clipChannel = v => (v < 0 ? 0 : v > COLOR_MAX ? COLOR_MAX : v)

const mapChannels1 = (color, f) => (
  {
    red: clipChannel(f(color.red)),
    green: clipChannel(f(color.green)),
    blue: clipChannel(f(color.blue)),
  }
)

const mapChannels2 = (c1, c2, f) => (
  {
    red: clipChannel(f(c1.red, c2.red)),
    green: clipChannel(f(c1.green, c2.green)),
    blue: clipChannel(f(c1.blue, c2.blue)),
  }
)

// For additive colors I'll use "light" terminology.

const addLight = (c1, c2) => (
  mapChannels2(c1, c2, (v1, v2) => v1 + v2)
)

// fraction between [0.0, 1.0]
const mixLight = (c1, c2, fraction) => (
  mapChannels2(c1, c2, (v1, v2) => v1*fraction + v2*(1-fraction))
)

// Words
// =====
// f(stack) -> stack.
// Stacks are represented as arrays, 0 is top.
//
// Types on stack
// --------------
// (these are likely to change!)
// - Animation:
//   .duration attribute in seconds
//   .color(time in [0,duration]) -> {red, green, blue}
// - Fixed color on stack represented as animation with .duration == 1
// - Number: TODO
// - Error: TODO value or exception?
//   TODO: voice message

let words = {}

const constWord = (value) => (
  stack => [value, ...stack]
)

const fixedColor = (red, green, blue) => ({
  duration: 1.0,
  color: time => ({red, green, blue}),
})

words.black = constWord(fixedColor(0, 0, 0))
words.red = constWord(fixedColor(COLOR_MAX, 0, 0))
words.yellow = constWord(fixedColor(COLOR_MAX, COLOR_MAX, 0))
words.green = constWord(fixedColor(0, COLOR_MAX, 0))
words.cyan = constWord(fixedColor(0, COLOR_MAX, COLOR_MAX))
words.blue = constWord(fixedColor(0, 0, COLOR_MAX))
words.purple = constWord(fixedColor(COLOR_MAX, 0, COLOR_MAX))
words.white = constWord(fixedColor(COLOR_MAX, COLOR_MAX, COLOR_MAX))

const finalColor = anim => anim.color(anim.duration)


// TODO: stack manipulation helpers — do I need a Stack class with methods?
// TODO: error for not enough arguments

const unaryWord = unaryFunc => (
  stack => {
    const [x, ...rest] = stack
    return [unaryFunc(x), ...rest]
  }
)

words.reverse = unaryWord(a => (
  {
    duration: a.duration,
    color: time => a.color(a.duration - time),
  }
))

words.slow = unaryWord(a => (
  {
    duration: a.duration * 2,
    color: time => a.color(time / 2),
  }
))

words.fast = unaryWord(a => (
  {
    duration: a.duration / 2,
    color: time => a.color(time * 2),
  }
))

const binaryWord = binaryFunc => (
  stack => {
    const [x, y, ...rest] = stack
    // TODO order?
    return [binaryFunc(x, y), ...rest]
  }
)

words.fade = binaryWord((a1, a2) => {
  // TODO should fade do something smarter given animations with duration?
  const c1 = finalColor(a1)
  const c2 = finalColor(a2)
  return {
    duration: 1.0,
    color: time => mixLight(c1, c2, time)
  }
})

// TODO naming: definitely not "concat". maybe "append"?
words.join = binaryWord((a2, a1) => (
  {
    duration: a1.duration + a2.duration,
    color: time => time < a1.duration ? a1.color(time) : a2.color(time - a1.duration),
  }
))

// 2 -> 2 word

words.swap = ([x, y, ...rest]) => [y, x, ...rest]

// i18n

hebrewWords = {
  שחור: words.black,
  אדום: words.red,
  צהוב: words.yellow,
  ירוק: words.green,
  תכלת: words.cyan,
  כחול: words.blue,
  סגול: words.purple,
  לבן: words.white,
  הפוך: words.reverse, הפוכ: words.reverse,
  מהר: words.fast,
  לאט: words.slow,
  מעבר: words.fade,
  חבר: words.join,
  החלף: words.swap,
}

module.exports = { words, hebrewWords };
