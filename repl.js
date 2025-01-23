const lang = require('./lang')

// REPL
// ----

const leds = require('./apa102_led_strip')

const readline = require('readline')
const chalk = require('chalk')

const sleep = milliSeconds => new Promise(resolve => setTimeout(resolve, milliSeconds))

const showColor = color => chalk.rgb(Math.round(lang.clipChannel(color.red)), Math.round(lang.clipChannel(color.green)), Math.round(lang.clipChannel(color.blue)))

// bidi hack — TODO use this depending on language
//
// Using a visible char because invisible chars like U+200F RIGHT-TO-LEFT MARK
// don't seem to affect pterm (Putty) which is currently bidi terminal I use.
const RIGHT_TO_LEFT = '׃' // U+05C3 HEBREW PUNCTUATION SOF PASUQ
const PROMPT = '؟ ' // U+061F ARABIC QUESTION MAKR

const showAnim = anim => {
  let s = ''
  if(anim.duration < 0.1) {
    s = showColor(anim.color(0))('❙') // U+2759 MEDIUM VERTICAL BAR
  } else {
    for(let time = 0; time <= anim.duration; time += 0.2) {
      s += showColor(anim.color(time))('█') // U+2588 FULL BLOCK
    }
  }
  return('[' + s + ']')
}

const showStack = stack => (
  stack.slice().reverse().map(anim => (
    RIGHT_TO_LEFT +
      ' '.repeat(20) +
      showAnim(anim) + '\n'
  )).join('')
)

// TODO: use shared time source to synchronize parallel animations to actual
// passage of time, instead of each one doing independent sleep().

const playAnim = async anim => {
  const step = 0.05
  for(let time = 0; time <= anim.duration; time += step) {
    const pos = Math.round(time / 0.2) // position inside [.....] above
    const color = anim.color(time)
    const colored = showColor(color)
    process.stdout.write(RIGHT_TO_LEFT +
                         ' '.repeat(3) +
                         '(' + colored('⬤').repeat(5) + ')' + // U+2B24 BLACK LARGE CIRCLE
                         colored('-').repeat((20 + '['.length + pos) - (3 + 1 + 5 + 1)) +
                         '^' +
                         '\r')
    await sleep(step * 1000)
  }
  //process.stdout.write('\n')
  process.stdout.write(' '.repeat(60) + '\r')
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
  let stack = stack0
  await playStack(stack)

  var reader = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    completer: line => (
      [Object.keys(dictionary).filter(w => w.startsWith(line)), line]
    ),
    prompt: PROMPT,
  })
  reader.prompt()
  reader.on('line', async line => {
    for (let w of line.trim().split(/\s+/)) {
      if (w == '') {
        // Allow <Enter> to re-display stack, useful after losing sight from errors and completions
        await playStack(stack)
      } else if (dictionary[w]) {
        stack = dictionary[w](stack)
        await playStack(stack)
      } else {
        console.error(`${w}: מה?`)
      }
      reader.prompt()
    }
  })

  return stack // is this reachable?
}

// TODO extract common loop from this and interactive repl()
const evalWords = async (dictionary, stack0, program) => {
  let stack = stack0
  await playStack(stack)
  await sleep(500)
  for(w of program) {
    console.log('#', w)
    stack = dictionary[w](stack)
    await playStack(stack)
    await sleep(500)
  }
  return stack
}

// TEST
// ----
// todo move somewhere

const test = async () => {
  await evalWords(lang.words, [], ['black', 'white',  'fade', 'white', 'black', 'fade', 'swap', 'glue'])

  await evalWords(lang.words, [], ['red', 'green',  'fade', 'green', 'blue', 'fade', 'slow', 'slow', 'glue', 'fast'])
}

//test()
repl(lang.hebrewWords, [])
