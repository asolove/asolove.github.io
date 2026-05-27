---
layout: post
title: "What are the important problems in UI engineering?"
description: "Let’s escape the day-to-day to survey what’s coming next"
date: 2017-04-21 09:00:00
categories: js ui
---

Very early in my programming career, I read a transcript of the talk [“You and Your Research”](http://www.cs.virginia.edu/~robins/YouAndYourResearch.html), by Richard Hamming, a mathematician whose name appears in the title of at least six Wikipedia pages for important things he invented.

I was struck by a question which he persistently asked of his colleagues:

> What are the important problems of your field?

and the observation he made of the successful scientists around him:

> Great scientists have thought through, in a careful way, a number of important problems in their field, and they keep an eye on wondering how to attack them.

and also by his scheme to devote at least a little time each week to that question and long-term thinking:

> I finally adopted what I called “Great Thoughts Time.’’ When I went to lunch Friday noon, I would only discuss great thoughts after that. By great thoughts I mean ones like: “What will be the role of computers in all of AT&T?’’, “How will computers change science?’’

This evening I spent my regularly-allotted time thinking about the important long-term problems in UI engineering and catching up with the research on attacking them.

I thought it might be worthwhile to share my own thinking and ask for your suggestions of important problems or ways of attacking them. **Please comment** if you think I’ve left something out or if you know of relevant attack vectors that I don’t mention.

The three problems I think the most about are: structured concurrency, understandable behavior, and data synchronization. Let’s look at each of them:

## Structured concurrency

Especially on the web, but also in native mobile development, it is still very easy to get concurrent behavior wrong. It is rare to see the code of a user interface that doesn’t have data races or use-after-dead problems related to components that fire off asynchronous chains that eventually trigger mutations. Promises are a great API for asynchronous behaviors, but not a great structure for composing behaviors together or ensuring they play nicely with other state changes in the UI.

On the web, the problem is even more severe because most JavaScript runs on the main thread and there is no convenient way to yield control back to the event loop while retaining your place in a long-running computation. For this reason, React had to rewrite their core algorithm to remove its recursive call structure and replace it with a data structure so that it can pause to let the event loop run and to re-evaluate whether it is working on the most important thing.

There are some available, partial attacks on these problems:

- [Ember-concurrency](https://github.com/machty/ember-concurrency) provides a shallow coroutine system for writing pausable, cancellable asynchronous tasks. This works well if your computation has a linear structure, but doesn’t solve the problem React has, of needing to pause in the middle of a recursive walk through a tree.
- [React Fiber](https://www.youtube.com/watch?v=ZCuYPiUIONs) solves the problem of yielding and scheduling in the middle of walking through your component hierarchy doing updates. But if your component callbacks or data-layer code are what’s taking up time, fiber doesn’t solve the problem.

And also more general, but not yet mainstream, approaches:

- For UI cases in particular, a natural fit is [the Concurrent ML primitives](/js/ui/2017/04/01/synchronizable-abstractions.html), which make it easy to express common UI needs like cancellable asynchronous transactions & speculative calculation. They don’t play nicely with the current JavaScript execution model, but…
- Other languages support coroutine- and continuation-based concurrency. This makes it possible to get pausable, cancellable tasks, even in arbitrarily-nested code. Some of those languages compile to JS, though generally with slower performance because they have to build data structures to replace the JS stack. There is research on how to do this [less slowly](http://users-cs.au.dk/danvy/sfp12/papers/thivierge-feeley-paper-sfp12.pdf). *Possibly*, the perceived performance improvements of scheduling work in the right order and yielding to the browser event loop every frame would outweigh the overall throughput decrease of slower-executing code.
- [WebAssembly](http://webassembly.org) will eventually be widely available and compiling other languages to C and then WebAssembly might let you eke out more performance. Current tests compiling existing languages to WebAssembly show a big performance penalty for languages like Scheme that use tail calls, because the WebAssembly VM assumes a normal stack discipline and you have to use trampolining and other indirect techniques. But hey, those other languages have a lot of baggage and features we don’t need. *Possibly, you* could implement a tiny language with just the bits you needed for Concurrent ML events. If you made a really great demo or could generalize your technique so that other high-level languages could use it, you could build a coalition to push for the features that would make this faster in post-MVP versions of WebAssembly. (There are some Scheme and ML folks in the webasm community, so they might not even need much convincing!)

I’m quite excited about Concurrent ML and the idea of making it work in the browser, even if slowly, in WebAssembly. So, though it’s well out of my comfort zone, I’ve been trying to attack that problem for an hour or two a day for the past few weeks. So far, I understand interpreter implementations and continuations a lot better. But my C is rusty enough I still have trouble getting things to a state that `emcc` will build. But it’s a fun little problem and one I expect that someone, though probably not me, will make progress on over the next few years.

I’m also thinking about how structured concurrency can be taught to web developers like me. Could we use a “Synchronized Schemer” book to teach how to work with channels and CML events? What’s the best way to make this salient to developers who just want to get something built and don’t currently know their code has data races?

## Understandable behavior

When building interactive systems, it is enormously difficult to understand their behavior because of the enormous state-space. You have to consider all the system’s data and operations multiplied by all the possible sequences of the user’s interactions. Unlike concurrent systems that don’t involve humans, which can often be defined narrowly in terms of fixed protocols, once a human being is involved and allowed to make decisions, the possible paths through the system become uncountable.

This raises a number of problems:

- Modifying an existing interface is often frightening because of the unknown and untestable myriad paths through it.
- Reproducing customer-reported bugs can be difficult even if you have their exact current data, because the problem may depend on a specific sequence of operations, or even the timing of asynchronous responses. We need not just snapshots, but records of change over time, to understand
- Trying to specify the behavior of an interactive system is enormously difficult. A fairly simple feature request can imply disproportionately difficult changes if it introduces new state space or operation interleaving possibilities.

This problem is under attack from a number of angles:

- Parts of this problem are made easier with disciplined use of types or contracts, immutable data, the Elm architecture, etc. But while these can certainly aid reasoning, they mostly do not solve the problem of large state-spaces and enumerating possible orderings of operations.
- *Designing with data* tools like [Subform](https://subformapp.com) make it easier to set up specific data states and manipulate them graphically, rather than in code. This can make it faster to explore the state space and notice potential problems.
- *Simulation testing* with tools like [Simulant](https://www.youtube.com/watch?v=N5HyVUPuU0E) attacks the problem of testing in large state-spaces by randomly selecting operations and searching for states where expected properties don’t hold.

In reflecting on this problem, I haven’t been able to find an angle of attack where I think I can help out. My current thinking is stalled on two ideas:

(Update on 8/10/17: after thinking about this problem more, I wrote the essay [*Pure UI Control*](/js/ui/2017/07/14/pure-ui-control.html), which describes the idea of “control state” and an explicit visual representation of UI behavior. This is an attempt to make it easier for programmers and non-programmers to share an artefact that allows them to reason about *all* the possible valid behaviors of a UI. I think that the conceptual separation of “data state” and “control state” can help us focus on the characteristics specific to control, which is what really creates the unique complexity in building interfaces.)

- We need a first-class construct that maps to an operation on the level of the user’s intention. It seems odd that we first encode the abstract operations of our system’s specification into states and transitions in our UI, then go back and write black-box simulations to test them. Both our code and tests could use a shared vocabulary for discussing user-initiated transitions in the state space. Then it would be easy to reproduce any case for manual or automated testing by simply specifying it with a name and some configuration and letting the system set it up for us. And building a simulation test would be as easy as telling the system to loop through and select any of the “user-level operations” that the UI is currently making available. How do you specify that the visual output of a UI offers a set of operations? How do you map those operations to low-level details like event handlers and the internal state machines of activity that implement them?
- One social difficulty is that UI tools tend to win popularity by how well they work for making glitzy demos where logic and visual display are intertwined. But making progress on understanding UIs depends on splitting state and logic from visual display. Can this conflict be reconciled by a UI system that funnels developers into a productive and scalable happy path by making many early decisions for them? (One inspiration for this comes from the world of back-end frameworks, where the Phoenix has [great educational materials](https://pragprog.com/book/lhelph/functional-web-development-with-elixir-otp-and-phoenix) to provide all the get-started-fast properties of Rails while funneling new developers into writing scalable OTP applications decoupled from the web frontend.)

My current work on this problem boils down to using various methods to try to make sense of the complex behaviors in the interfaces I work on. I’ve tried some formalisms, different sketching techniques, etc., all things above the level of actual code but that aspire to fully encapsulate the code’s behavior. I try to read up on formalisms about effects, like [Idris](https://www.manning.com/books/type-driven-development-with-idris)’ effects and concurrent typing. I’ve had some success with specific diagram techniques, but not anything I could make systematic. So I think about this a lot, but haven’t made any progress.

## Data synchronization

The network eventually absorbs every application that used to live only on a single computer. From making small web apps work while offline to correctly merging multiple users’ edits on large documents, we are going to need a wide array of options for synchronizing data. Perhaps more importantly, we need a social solution for packaging these options and helping developers use them in practice. The domain of distributed systems, currently only inhabited by experts, will be an expected feature in run-of-the-mill apps and websites.

If the community gets this wrong and doesn’t package up good options and help steer people towards the right tool for their use-case, we’re going to end up with some truly terrible problems. Our current problem with slow-loading sites will look like nothing compared with sites that have data cacheing problems or that silently merge away your changes when they sync with the server.

I know of a couple fronts in the battle against this problem:

- In-browser declarative query languages and network-aware data stores like [GraphQL](http://graphql.org)/[Relay](https://facebook.github.io/relay/docs/relay-modern.html) provide the structure needed to do systematic cacheing and offline query resolution. (Doing this correctly yourself, for arbitrary REST APIs with joins and other dependencies, is not fun.) But they don’t help much with the problem of resolving local edits made while offline against changes made on the server.
- [CRDTs](https://www.youtube.com/watch?v=9xFfOhasiOE) are data types that support eventual consistency when changed independently in multiple locations. [Phoenix Presence](https://www.youtube.com/watch?v=n338leKvqnA) is an interesting use-case that uses CRDTs to sync data both between distributed backend servers and to JavaScript clients. (The core of it, implementing the same CRDT with the same semantics in both Elixir and JS, could be a great basis for a generic data synchronization system.) Another interesting project is [Lasp](http://lasp-lang.readme.io/docs/what-is-lasp), a distributed programming model that uses CRDTs and some programming limitations to guarantee eventual data consistency.
- Model-theory-oriented approaches use database theory ideas like MVCC and Datalog and try to map them to useful properties of distributed data systems. Peter Alvaro gave a mind-bending talk [“I See What You Mean”](https://www.youtube.com/watch?v=R2Aa4PivG0g) about how Datalog’s semantics might be helpful in a distributed system. Yifan Wu gave another talk about [what consistency means for user interface development](https://www.youtube.com/watch?v=IZe3yvVMwqM) that makes the problem very concrete. The two also have a great [Papers We Love talk twofer](https://www.youtube.com/watch?v=yRNbZSUsre0): one short talk by Yifan Wu on how database consistency models differ from the mental models humans inately have about consistency of UIs, and then a longer talk by Peter Alvaro about how model theory deals with the idea of causation.

An example of a real system built with these ideas is [Eve](http://witheve.com), a new model for programming that is built on top of a fast distributed data store and uses a Datalog-like pattern matching language for expressing rules. I spent some time writing toy Eve programs a few months ago and really enjoyed it. The current programming IDE and docs have some rough edges, and the things it can currently do aren’t that hard to with JS. But because Eve is built on top of a solid model for distributed data, once the distribution and permissions parts are available, it’s going to be a very interesting way to write distributed apps.

This is a hard but important problem, probably the most important one for the field. But I don’t know enough to help with it yet. So I’m keeping my eye on CRDT stuff in Erlang and JavaScript, and waiting for distributed Eve to become available, but not actively working on the problem.

Those are the three important problems for UI engineering that I think about the most.

Did I miss some vectors of attack for those problems? What other important problems do you think about? Leave a comment or write me a long email!

## Responses

- [Ward Cunningham summarizes](http://ward.bay.wiki.org/view/problems-in-ui-engineering) this article and offers the reflection that [Federated Wiki](http://video.fed.wiki.org/view/welcome-visitors/view/federated-wiki-videos) has often chosen to “sidestep or postpone” features that interact with the three problems I discussed. That’s an overly humble response. Federated Wiki takes a very clever approach: solve the data syncing problem by deliberately not trying to solve it. Instead, it encourages users to make their own copy of any page and edit that separate copy. Combined with features like distributed search and social discovery, this is a great way to deal with distributing data. Letting the data just live at the network’s edges is a great solution when you can get away with it.

---

<small>*Originally published on [Medium](https://asolove.medium.com/what-are-the-important-problems-in-ui-engineering-8b7f8b305611).*</small>
