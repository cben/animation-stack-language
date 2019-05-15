# A stack language REPL for kids

My kids are 4yo and 6yo (as I started working on this), have a lot of experience with tablets but none with textual interfaces.
Ofek reads well and writes, Maayan doesn't quite read yet.

I want not only to teach some coding but also to _encourage literacy_.
I want a "CLI" where typing gives them some magic power, specifically controlling the RGB light in their room.

## Why a stack language?

 1. The notional machine is _extremely_ simple and transparent.

    I'll forever remember the glorious illustrations from _Starting Forth_ I read as teenager,
    e.g. the [double-headed `swap` dragon][1] whose one head grabs the top item off the stack,
    second head grabs the next item, then they put them back in reverse order.

    [1] https://www.forth.com/starting-forth/2-stack-manipulation-operators-arithmetic/#SWAP

    The price of simple machines, is they're extremely _imperative_ & descructive.
    Many actions _consume_ a 1 or 2 last produced values off the stack, and if that's not what you wanted, bummer 💣...

 2. No structured syntax to learn/understand!

    In a typical language with nested syntax you could implement blinking as
    `twice { fade(black, white) ; fade(white, black) }`.
    In weird structured postfix it'd become:
    `{ ( (black, white)fade, (white, black)fade )join }twice`
    but there's all this punctuation to get right; in stack language it's just:
    `     black  white fade   white  black fade  join  twice`

    The price of no syntax is the structure is implicit and has to be inferred from each function's arity:

    ```
    black white fade white black fade join twice
    🡖-----🡖-----🡕    🡖-----🡖-----🡕
    🡖-----------------🡖---------------🡕
    🡖---------------------------------------🡕
    ```

    This is very bad for readability!  That's why most people don't use concatenative languages!

But I think for small enough kids these can be acceptable, with some mitigations:

### 1. Feedback & undo

I'm going to visualize the stack after _every_ operation, with immediate feedback as you edit.

The top value on the stack is "executed".
This also means one can learn "type a color, see it" feedback cycle without understanding the stack yet;
but the previous values are there, like outputs of a REPL, waiting until you discover functions with arguments like `mix`...

Destructivity is not a problem if _undo_ is easy.  The natural way to undo writing the wrong thing is <kbd>Backspace</kbd>!
So everything should be re-computed from the point you edit forward.

### 2. No control _flow_ – animations as _values_

In a traditional language, `twice { ... }` is a control structure (aka "special form" in lisp).
Unlike regular function application, control flows through its body twice.
In many languages control structures are also syntactically distinct, e.g. using braces instead of parens.

This is (1) complicated 😨 (2) makes syntatic structure — knowing where the body of a control structure begins and ends — especially important 🙁.
So if I want to get rid of structure, **I need flat semantics**.  Control flow should be left-to-right, period.

We can regain a (limited) ability to express and combine behavior over time by making animations first-class values ⌚!

- `fade` returns an animation which takes, say, 1 second.
- `join` concatenates 2 animations into one.
- `twice` = `2 times` = `dup join` just concatenates the top animation with itself.

```
black    white    fade        white    black        fade        join             twice
     [█]      [ ]     [█▓▒░ ]      [ ]      [█]         [ ░▒▓█]     [█▓▒░  ░▒▓█]      [█▓▒░  ░▒▓██▓▒░  ░▒▓█]
              [█]                  [█▓▒░ ]  [ ]         [█▓▒░ ]
                                            [█▓▒░ ]
```

Visualizing processes as graphs of time is an important idea to teach in itself!
Cf. Bret Victor's  http://worrydream.com/LadderOfAbstraction/ and http://worrydream.com/#!/MediaForThinkingTheUnthinkable .
