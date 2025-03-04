# A stack language REPL for kids

My kids are 4yo and 6yo (as I started working on this), have a lot of experience with tablets but none with textual interfaces.
Ofek reads well and writes, Maayan doesn't quite read yet.

I want not only to teach some coding but also to _encourage literacy_.
I want a "CLI" where typing gives them some magic power, specifically controlling the RGB light in their room.

## UI: https://animation-stack-language.netlify.app/

⚠ Experimental ^_^.

Shows stack at current cursor position, updated on any edit / cursor movement (BUG: only when placed between words).

Locally:
```sh
git clone https://github.com/cben/animation-stack-language
cd animation-stack-language
yarn install
yarn start
```
Then open http://localhost:4321/.


## How to run — terminal REPL

One command per line.  No way to go back and edit previous commands.

```sh
git clone https://github.com/cben/animation-stack-language
cd animation-stack-language
yarn install
LANG=en node repl.js
```

Press TAB to list of known commands.  You'll want a terminal that supports both True Color attributes and right-to-left text (for Hebrew).  `pterm` (port of Putty from windows) worked best for me on Fedora; `konsole` is also not bad.

* Currently supports English and Hebrew; REPL language choosen by env vars e.g. `LANG=he.UTF-8 node repl.js`.
* Translation pull requests welcome!

## Why a stack language?

 1. The notional machine is _extremely_ simple and transparent.

    I'll forever remember the glorious illustrations from _Starting Forth_ I read as teenager,
    e.g. the [double-headed `swap` dragon][1] whose one head grabs the top item off the stack,
    second head grabs the next item, then they put them back in reverse order.

    [1]: https://www.forth.com/starting-forth/2-stack-manipulation-operators-arithmetic/#SWAP

    The price of simple machines, is they're extremely _imperative_ & destructive.
    Many actions _consume_ a 1 or 2 last produced values off the stack, and if that's not what you wanted, bummer 💣...

 2. No structured syntax to learn/understand!

    In a typical language with nested syntax you could implement blinking as:
    ```
    twice { fade(black, white) ; fade(white, black) }
    ```
    In weird structured postfix it'd become:
    ```
    { ( (black, white)fade, (white, black)fade )glue }twice
    ```
    but there's all this punctuation to get right; in stack language it's just:
    ```
         black  white fade   white  black fade  glue  twice
    ```

    The price of no syntax is the structure is implicit and has to be inferred from each function's arity:

    ```
    black white fade white black fade glue twice
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
- `glue` concatenates 2 animations into one.
- `twice` = `2 times` = `dup glue` just concatenates the top animation with itself.

```
black    white    fade        white    black        fade        glue             twice
     [█]      [ ]     [█▓▒░ ]      [ ]      [█]         [ ░▒▓█]     [█▓▒░  ░▒▓█]      [█▓▒░  ░▒▓██▓▒░  ░▒▓█]
              [█]                  [█▓▒░ ]  [ ]         [█▓▒░ ]
                                            [█▓▒░ ]
```

Visualizing processes as graphs of time is an important idea to teach in itself!
Cf. Bret Victor's  http://worrydream.com/LadderOfAbstraction/ and http://worrydream.com/#!/MediaForThinkingTheUnthinkable .

Alas, so far I've FAILED to explain this "animation" concept to my family ☹️

## Future

### Defining custom words

I'm considering making it part of the UI — give you a separate editor per word — to escape the question of definition syntax.

Prior art to look at:
- Brief: concatenative refactoring https://www.youtube.com/watch?v=R3MNcA2dpts
- Mu with collapsible calls showing stack after every op https://archive.org/details/akkartik-2min-2020-12-06 (and some prior videos)
- Boxer.

Specifically, unlike above Mu video where definitions are edited separately from the execution trace, I want to normalize editing definitions *inside an expanded call*.  
Having some prior arguments (an "example") prepared before a call is essential for showing live values while editing a parametrized function (cf. [Babylonian-Style Programming][]); 
having some post-processing after the call enables workflows like unit tests verifying a result, or rendering a View while working on Model logic...  
It seems to me in-call editing could subsume various IDE functionalities that folks build for "example oriented programming" (?)

[Babylonian-Style Programming]: https://arxiv.org/pdf/1902.00549

### Collaborative editing

I want to plug this into something like firepad / Yjs to support remote coding sessions.

### New types: vectors / graphics

I want to progress into graphics and possibly even simple games.
=> The stack element type will likely change to vectors / pictures.

Not entirely unlike turtle graphics, but with explicit operators to combine pictures by movement / rotation / scaling / overlaying / intersections?

#### Interaction?!?

I have some crazy ideas about how to represend input during games as appending words to definitions...  Pro: would work over collaborative editor for "multiplayer" (let's say step-based games only).  Con: crazy :-P.  Not sure at all yet if it's viable and whether it'll mix with current idea that stack elements are an animation over time...
