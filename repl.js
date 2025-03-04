const lang = require('./lang')

// REPL
// ----

const leds = require('./apa102_led_strip')

const readline = require('readline')
const chalk = require('chalk')
const stringWidth = require('string-width')

const sleep = milliSeconds => new Promise(resolve => setTimeout(resolve, milliSeconds))

// Returns a function from text to colored text.
const showColor = color => chalk.rgb(Math.round(lang.clipChannel(color.red)), Math.round(lang.clipChannel(color.green)), Math.round(lang.clipChannel(color.blue)))

// bidi hack
//
const LANG = lang.userLanguage()
let PROMPT, DIRECTION
if (lang.isRightToLeft(LANG)) {
  PROMPT = '؟ ' // U+061F ARABIC QUESTION MARK
  // Using a visible char because invisible chars like U+200F RIGHT-TO-LEFT MARK
  // don't seem to affect pterm (Putty) which is currently bidi terminal I use.
  DIRECTION = '׃' // U+05C3 HEBREW PUNCTUATION SOF PASUQ
} else {
  PROMPT = '? '
  DIRECTION = ' '
}

const ERROR_CHAR = '✗' // U+2717 BALLOT X

const showAnim = anim => {
  let s = ''
  const duration = lang.getDuration(anim)
  if (duration < 0.1) {
    try {
      s = showColor(anim.color(0))('❙') // U+2759 MEDIUM VERTICAL BAR
    } catch (e) {
      s = chalk.red(ERROR_CHAR)
    }
  } else {
    for (let time = 0; time <= duration; time += 0.2) {
      try {
        s += showColor(anim.color(time))('█') // U+2588 FULL BLOCK
      } catch (e) {
        s += chalk.red(ERROR_CHAR)
      }
    }
  }
  return ('[' + s + ']')
}

const ANIM_INDENT = 20

const showStack = stack => (
  stack.slice().reverse().map(anim => (
    DIRECTION +
    ' '.repeat(ANIM_INDENT) +
    showAnim(anim) + '\n'
  )).join('')
)

// TODO: use shared time source to synchronize parallel animations to actual
// passage of time, instead of each one doing independent sleep().

const playAnim = async anim => {
  const duration = lang.getDuration(anim)
  const animWidth = stringWidth(showAnim(anim))
  const step = 0.05
  for (let time = 0; time <= duration; time += step) {
    let colored, bulbChar, errorMessage
    try {
      const color = anim.color(time)
      colored = showColor(color)
      bulbChar = '⬤'.repeat(6)  // U+2B24 BLACK LARGE CIRCLE
      errorMessage = ''
    } catch (e) {
      colored = char => char
      bulbChar = '💥'.repeat(3) // U+1F4A5 COLLISION SYMBOL, double-width
      errorMessage = chalk.red(ERROR_CHAR + ' ' + e)
    }
    const bulb = ' '.repeat(3) + '(' + colored(bulbChar) + ')'

    //                     [██████████]
    // (⬤⬤⬤⬤⬤⬤)------------^       ✗ errorMessage
    const posInAnim = Math.round(time / 0.2)
    process.stdout.write(DIRECTION +
      bulb +
      colored('-').repeat(-stringWidth(bulb) + ANIM_INDENT + '['.length + posInAnim) +
      '^' +
      ' '.repeat(-(posInAnim + '^'.length) + animWidth + 2) +
      errorMessage +
      '\r')
    await sleep(step * 1000)
  }
  //process.stdout.write('\n')
  process.stdout.write(' '.repeat(ANIM_INDENT + animWidth) + '\r')
}

const BRIGHTNESS = parseInt(process.env.LEDS_BRIGHTNESS) || 255

const ledsShowStackAtTime = async (stack, time) => {
  //process.stdout.write(time + ' ')
  let led = 0
  for(let i = stack.length - 1; i >= 0; i--) {
    const anim = stack[i]
    // animate, when done, stay at final color
    //const color = anim.color(Math.min(time, anim.duration))
    // TODO: leds are far too bright, not similar to colors on screen
    // (e.g. dark brown on screen is still quite bright pink on leds)
    for(let t = 0; t <= anim.duration; t += 0.2) {
      const color = anim.color(Math.min(t, anim.duration))
      if(led < leds.NLEDS) {
        leds.setRGBb(led++, lang.clipChannel(color.red), lang.clipChannel(color.green), lang.clipChannel(color.blue), BRIGHTNESS)
      }
      //process.stdout.write(showColor(color)(' ' + i))
    }

    // And a bigger gap between stack items:
    leds.setRGBb(led++, 0, 0, 0, 0)
    leds.setRGBb(led++, 0, 0, 0, 0)
    leds.setRGBb(led++, 0, 0, 0, 0)
  }

  // clear to black beyond bottom of stack
  while(led < leds.NLEDS) {
    leds.setRGBb(led++, 0, 0, 0, 0)
  }
  await leds.send()
  //process.stdout.write('\n')
}

const ledsPlayStack = async stack => {
  if(stack.length === 0) {
    await ledsShowStackAtTime(stack, 0) // force clearing LED strip to black.
    return
  }
  const maxDuration = Math.max(...stack.map(a => a.duration))
  const step = 0.05
  // TODO: it seems white->black fades don't reach complete fade, why?
  for(let time = 0; time <= maxDuration; time += step) {
    await ledsShowStackAtTime(stack, time)
    await sleep(step * 1000)
    break //TODO
  }
}

const playStack = async stack => {
  console.log(showStack(stack))
  const promises = [ledsPlayStack(stack)]
  if (stack.length > 0) {
    // TODO: for fast ingestion of long programs, skip(?) all animations while we have pending input.  
    //promises.push(playAnim(stack[0]))
  }
  await Promise.all(promises)
}

const repl = async (dictionary, stack0) => {
  const allCompletions = Object.keys(dictionary).sort()
  var reader = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    completer: line => (
      [allCompletions.filter(w => w.startsWith(line)), line]
    ),
    prompt: PROMPT,
  })

  let state = lang.initialState(dictionary, stack0)
  await playStack(state.stack)

  reader.prompt()
  reader.on('line', async line => {
    for (let w of line.trim().split(/\s+/)) {
      if (w == '') {
	    // Allow <Enter> to re-display stack, useful after losing sight from errors and completions
	    await playStack(state.stack)
	  } else {
	    state = lang.evalSmallStep(state, w)
        if (state.error) {
          console.error(`${ERROR_CHAR} ${state.error}: ${state.errorMessage}`)
        } else {
          await playStack(state.stack)
        }
      }
    }
  })

  // would be nice to return final state, but all evaluation
  // happens async in reader callback after we return. 
}

// TODO extract common loop from this and interactive repl()
const evalWords = async (dictionary, stack0, program) => {
  let state = lang.initialState(dictionary, stack0)
  await playStack(state.stack)
  await sleep(500)
  for (const w of program) {
    console.log('#', w)
    state = lang.evalSmallStep(state, w)
    if (state.error) {
      console.log(chalk.red(`${ERROR_CHAR} ${state.error}: ${state.errorMessage}`))
    }
    await playStack(state.stack)
    await sleep(500)
  }
  return state.stack
}

// TEST
// ----
// todo move somewhere

const test = async () => {
  const dictionary = lang.wordsByLanguage.en
  // test error handling.
  await evalWords(dictionary, [], ['fade', 'yellow', 'fade', 'swap', 'cyan', 'purple', 'fade', 'swap', 'XYZ', 'swap'])
  await evalWords(dictionary, [], ['black', 'white', 'fade', 'white', 'black', 'fade', 'swap', 'glue'])
  await evalWords(dictionary, [], ['red', 'green', 'fade', 'green', 'blue', 'fade', 'slow', 'slow', 'glue', 'fast'])
}

//test()
repl(lang.wordsByLanguage[lang.userLanguage()], [])
