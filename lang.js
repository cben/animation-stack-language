// Color helpers
// -------------
// {red, green, blue} using 0..255 interval
// TODO 255 not friendly to kids, probably want 0..100 range, but what's best internal representation?

// TODO there is probably an npm module doing all this better

const COLOR_MAX = 255
const clipChannel = v => (v < 0 ? 0 : v > COLOR_MAX ? COLOR_MAX : v)

const mapChannels1 = (color, f) => (
  {
    red: f(color.red),
    green: f(color.green),
    blue: f(color.blue),
  }
)

const mapChannels2 = (c1, c2, f) => (
  {
    red: f(c1.red, c2.red),
    green: f(c1.green, c2.green),
    blue: f(c1.blue, c2.blue),
  }
)

// For additive colors I'll use "light" terminology.

const addLight = (c1, c2) => (
  mapChannels2(c1, c2, (v1, v2) => v1 + v2)
)

// fraction between [0.0, 1.0]
const mixLight = (c1, c2, fraction) => (
  mapChannels2(c1, c2, (v1, v2) => v1 * fraction + v2 * (1 - fraction))
)

// Animations
// ----------
// .duration attribute in seconds
// .color(time in [0,duration]) -> {red, green, blue}

// normalizes time to [0, 1] range, safely mapping t/0 to 0.
const timeFraction = (time, duration) => (
  duration > 0 ? time / duration : 0
)

const mapTime = (anim, f) => (
  {
    duration: anim.duration,
    // Typically f(color) ignores time, but optionally can look at 2nd argument f(color, time)
    color: time => f(anim.color(time), timeFraction(time, anim.duration)),
  }
)

const mapTime2 = (a1, a2, f) => (
  {
    // TODO: do something smarter given animations with different duration
    duration: a1.duration,
    color: time => f(a1.color(time), a2.color(time), timeFraction(time, a1.duration)),
  }
)


// Words
// =====
// f(stack) -> stack.
// Stacks are represented as arrays, 0 is top.
//
// Types on stack
// --------------
// (these are likely to change!)
// - Currently, only animations!
// - Fixed color on stack represented as animation with .duration == 1
// - Number: TODO
// - Error: TODO value or exception?
//   TODO: voice message

// Error handling: Guarantees a number, -1 for errors.
const getDuration = anim => (
  (anim && typeof anim.duration === 'number') ? anim.duration : -1
)

let words = {}

const constWord = (value) => (
  stack => [value, ...stack]
)

const fixedColor = (red, green, blue) => ({
  duration: 1.0,
  color: time => ({ red, green, blue }),
})

const colors = {
  black: fixedColor(0, 0, 0),
  red: fixedColor(COLOR_MAX, 0, 0),
  yellow: fixedColor(COLOR_MAX, COLOR_MAX, 0),
  green: fixedColor(0, COLOR_MAX, 0),
  cyan: fixedColor(0, COLOR_MAX, COLOR_MAX),
  blue: fixedColor(0, 0, COLOR_MAX),
  purple: fixedColor(COLOR_MAX, 0, COLOR_MAX),
  white: fixedColor(COLOR_MAX, COLOR_MAX, COLOR_MAX),
}

for (name in colors) {
  words[name] = constWord(colors[name])
}

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

words.dark = unaryWord(a => mapTime(a, c => mapChannels1(c, x => x * 0.5)))
words.light = unaryWord(a => mapTime(a, c => mapChannels1(c, x => x * 2)))
// TODO is this the best behavior?
// + mixing with white avoids overflow
// - `dark light` are not inverses like `slow fast`
// - both dark and light reduce saturation!
//words.light = unaryWord(a => mapTime(a, c => mixLight(c, colors.white, 0.5)))

const binaryWord = binaryFunc => (
  stack => {
    const [x, y, ...rest] = stack
    // TODO order?
    return [binaryFunc(x, y), ...rest]
  }
)

words.mix = binaryWord((a1, a2) => (
  mapTime2(a1, a2, (c1, c2) => (
    mixLight(c1, c2, 0.5)
  ))
))

words.add = binaryWord((a1, a2) => (
  mapTime2(a1, a2, (c1, c2) => (
    addLight(c1, c2)
  ))
))

words.fade = binaryWord((a1, a2) => (
  mapTime2(a1, a2, (c1, c2, timeFraction) => (
    mixLight(c1, c2, timeFraction)
  ))
))


// TODO naming: definitely not "concat". maybe "append"?
words.glue = binaryWord((a2, a1) => (
  {
    duration: a1.duration + a2.duration,
    color: time => time < a1.duration ? a1.color(time) : a2.color(time - a1.duration),
  }
))

// stack words
// TODO error when not enough arguments.

words.drop = ([x, ...rest]) => [...rest]
words.copy = ([x, ...rest]) => [x, x, ...rest]
words.swap = ([x, y, ...rest]) => [y, x, ...rest]

// rgbAnimation -> redAnimation greenAnimation blueAnimation

words.split = stack => {
  const [anim, ...rest] = stack
  let r = mapTime(anim, ({ red, green, blue }) => ({ red, green: 0, blue: 0 }))
  let g = mapTime(anim, ({ red, green, blue }) => ({ red: 0, green, blue: 0 }))
  let b = mapTime(anim, ({ red, green, blue }) => ({ red: 0, green: 0, blue }))
  return [b, g, r, ...rest]
}

// i18n
// ----

let hebrewWords = {
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
  כהה: words.dark,
  בהיר: words.light,
  פצל: words.split,
  ערבב: words.mix,
  מעבר: words.fade,
  חבר: words.add,
  הדבק: words.glue,
  החלף: words.swap,
  זרוק: words.drop,
  שכפל: words.copy,
}

// Semantics
// =========
// TODO: support calling named definitions.

const initialState = (dictionary, stack) => (
  { dictionary, stack, error: null, errorMessage: null }
)

// Evaluates a single word.
// Errors deliberately preserve previous stack, and are cleared on next word -
// this way when typing in the middle, only the current incomplete word is affected.
const evalSmallStep = (state, word) => {
  const { dictionary, stack } = state
  if (dictionary.hasOwnProperty(word)) {
    try {
      const newStack = dictionary[word](stack)
      return { dictionary, stack: newStack, error: null, errorMessage: null }
    } catch (e) {
      // Note this only catches exceptions immediately in the word function.
      // Many words construct stack elements with a .color function which
      // can explode later when called to visualize a stack element...
      return { dictionary, stack, error: 'Exception', errorMessage: e }
    }
  } else {
    // TODO: i18n error messages
    return { dictionary, stack, error: 'NameError', errorMessage: 'מה?' }
  }
}

module.exports = {
  COLOR_MAX, clipChannel,
  words, hebrewWords,
  getDuration,
  initialState, evalSmallStep,
}
