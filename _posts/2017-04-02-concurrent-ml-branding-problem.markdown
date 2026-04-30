---
layout: post
title: "Concurrent ML has a branding problem"
description: "And some suggestions from a complete outsider"
date: 2017-04-02 12:00:00
categories: js ui
---

Yesterday I published a post arguing that [more programmers should learn about Concurrent ML](/js/ui/2017/04/01/synchronizable-abstractions.html). Especially for UI development, CML offers better abstractions and some ready-made solutions for problems that are currently hard or ugly to solve.

But experts in this material may have noticed something odd about my post: I tried very hard to avoid saying “Concurrent ML” except when actually discussing the history of the ideas. Instead, I used names like “synchronizable abstraction” and “protocol” in an effort to make the ideas clearer to those who had never heard of CML.

*So, disclaimer*: I’m not an expert in CML. Heck, I finished the book last week and just started trying to compose my own programs with events.

*However,* over the last few weeks I spent a lot of time reading through the online discussion about CML (especially as compared with Go’s synchronous messages and Erlang’s asynchronous ones) and I came to a clear conclusion:

| There is no convenient, generally-useful way to refer to the core ideas of CML, and this naming problem makes it harder to introduce new people to the ideas.

The two obvious names to use both have significant problems:

- The name “Concurrent ML” sounds like it’s just the API for programming concurrency in one particular (and fairly obscure) language. Anyone who doesn’t already know what CML is will immediately dismiss it as not of interest to them. The name also doesn’t cover or bring to mind the many other implementations of CML’s core ideas.
- The “Event” abstraction has a similar naming problem. In standard programming parlance, an event is a description of an already-completed action, which we may choose to respond to. An event also signifies something fundamentally simple: “event combinator” sounds almost contradictory. These two connotations bring to mind the opposite of what CML’s events represent. In addition, any phrase with “event” in it, like “event-oriented”, is already taken by not just a different abstraction, but a completely different problem domain.
- As a third option, The Racket Guide and other Racket docs consistently use the name “[synchronizable events](https://docs.racket-lang.org/reference/sync.html)”. This is better, but still has a few connotation problems and has not been widely adopted.

Without a convenient name that is at least somewhat meaningful to newcomers, it is very hard to discuss these ideas. As one example, try reading Andy Wingo on [adopting the CML primitives in Guile](https://wingolog.org/archives/2016/09/21/is-go-an-acceptable-cml). He’s a brilliant guy, and writing for an audience of knowledgeable Scheme programmers, but notice how awkward it is to just get a handle on the ideas. Compare it to the way he talks about Go, with very concrete names. For the ideas he actually wants to talk about, he is stuck using phrases like “the CML primitives” for lack of a better name.

I would humbly suggest that for these ideas to gain broader adoption, they **need a clearer name**. The name should describes the CML ideas, including as implemented in Racket or any other language, and should at least connote the right problem domain to programmers reading it for the first time.

When I sat down to think about what I learned from the CML book, it had to do with a way of thinking that provided communication, synchronization, composition, and abstraction. Combining those ideas with arbitrary positive technical qualities gives us some candidate names, like:

- Synchronizable abstractions
- First-class communication
- Composable protocols

Which seem to correctly connote the problem domain of concurrent communication and a solution worth learning about.

I might also venture an uninformed opinion that, if you’re introducing it to a new environment, “event” is the wrong name to use. *Event* connotes something simple and past. We want a name that describes something compound and hypothetical. It also needs to be a noun that means *describing,* rather than carrying out, an action.

What about *protocol*? After all, a protocol is a description of all possible correct communications. That gets us compound, hypothetical, and a connection to safety. In this terminology, CML’s “primitive events” become the “trivial protocols”, like sending and receiving single messages. And CML’s main features become protocol combinators: ways to build more complex protocols from simpler ones. I also think this language makes the idea sounds attractive and mind-expanding to the right audience of programmers.

I apologize for the presumption of these suggestions after only a brief period working with the CML ideas. I hope you’ll forgive me and reply with your own thoughts.

---

<small>*Originally published on [Medium](https://asolove.medium.com/concurrent-ml-has-a-branding-problem-ce0286eab598).*</small>
