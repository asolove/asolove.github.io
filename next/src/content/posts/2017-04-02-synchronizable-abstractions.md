---
layout: post
title: "Synchronizable abstractions for understandable concurrency"
description: "Or: what is Concurrent ML all about?"
date: 2017-04-02 02:32:19
categories: js ui
tags: functional ui
---

In this post I'd like to introduce you to a powerful idea for thinking about concurrent programs. Synchronizable abstractions were developed more than twenty years ago by John Reppy in his work creating the language [Concurrent ML](http://cml.cs.uchicago.edu). Despite that age, and their use in several large-scale systems, synchronizable abstractions remain little known.

### Why learn about synchronizable abstractions?

- They'll expand your mind by unifying Go's synchronous channels, Haskell's MVars, and JavaScript's promises under one new primitive.
- They're already used by programmers with trustworthy taste, like the implementers of [Racket](https://docs.racket-lang.org/reference/sync.html) and [Guile Scheme](https://github.com/wingo/fibers).
- Concurrent ML partly inspired React Fiber and can help us understand some of the trickiest concurrency issues in JavaScript UIs.

One blog post isn't enough to cover all of the detail of synchronizable abstractions. So my goals are less ambitious: to **motivate** the ideas by showing the problems they solve, to **outline** the primitives, combinators, and programming style they allow, and then to **suggest resources** if you want to learn more.

## Understandable concurrency in Go

Let's start by solving a small problem using Go-style concurrency, without the synchronizable abstractions primitives. In a typical Go program, many lightweight threads communicate with each other via synchronous messages sent over channels. When one thread wants to send or receive a message over a channel, it blocks until a suitable partner thread is ready to receive or send. This synchronous message passing makes it possible for messages to both communicate and synchronize between threads.

Let's see an example of this style of program *(and also get used to the ES6-like pseudo-code used in this article)*. We'll implement a simple communication protocol where two threads atomically swap values. Our swap function accepts the value to send and returns the value received. Here's how we want it to work:

```javascript
let swap = new SwapChannel()

let swapper = oldValue => spawn(() =>
  let newValue = swap(oldValue)
  console.log("Swapped", oldValue, "for", newValue))

swapper(1)
swapper(2)
// "Swapped 1 for 2" & "Swapped 2 for 1" are printed, in some order.
```

Because channels only send messages in one direction, our implementation will need to send two messages and make sure that they happen atomically.

A naive implementation of a swap channel might look like this:

```javascript
let SwapChannel = () => {
  let ch = new Channel()
  return (value) => {
    select {
      case send(ch, value):
        return receive(ch)
      case newValue = receive(ch):
        send(ch, value)
        return newValue
    }
  }
}
```

It first constructs a plain channel and then returns a function that clients can call when they want to perform a swap. When a thread calls that function, it tries to both send and receive over the channel, blocking until another thread is also ready to swap. (Note the new select/case syntax, which allows threads to propose multiple communications, block until one of them succeeds, and then carry out the statements appropriate to that case.) The thread that succeeds in sending its value then waits to receive a value in return. The thread that first succeeds in receiving likewise then sends its value back.

Unfortunately, this code has a bug. If three threads all call swap at roughly the same time, we may not get an atomic swap between two of them, but instead a three-way cyclic exchange between all three threads. This is not the atomic swap we wanted.

<figure>
  <img src="/img/synchronizable-abstractions/three-way-cyclic-exchange.png" alt="Sequence diagram showing three threads communicating cyclically over a single channel">
  <figcaption>Each line represents a thread, with time moving from left to right. Threads offer to receive (empty circle) or send (full circle) on a channel. They then block (dotted lines) until one of the communications actually occurs (arrow).</figcaption>
</figure>

To fix this problem, we need to ensure that once two threads do the first step in the swap, they can only communicate with each other when doing the second step. The solution is to create a new channel, send it as part of the first communication, then use it for the second communication.

<figure>
  <img src="/img/synchronizable-abstractions/private-channel-swap.png" alt="Sequence diagram showing two threads exchanging values via a private reply channel">
  <figcaption>A private channel ensures a correct swap.</figcaption>
</figure>

Even if a third thread comes along in the middle of the swap, it can't interfere with the in-process transaction because it doesn't have access to the private channel. It instead blocks and waits for another thread that wants to perform a swap.

Implementing this idea requires only small changes:

```javascript
let SwapChannel = () => {
  let ch = new Channel();
  return value => {
    let replyCh = new Channel();
    select {
      case send(ch, [value, replyCh]):
        return receive(replyCh);
      case [newValue, replyCh] = receive(ch):
        send(replyCh, value)
        return newValue
    }
  }
}
```

Notice that in this brief code, synchronous message passing is used for communication, synchronization, and security. And the correctness of our swap operation is encapsulated inside the returned function, preventing any thread from violating the protocol.

### The tradeoff: abstraction, composition, or safety?

Now that we have a safe swap channel abstraction, we want to use it in other server processes. (Remember that while swap is trivial, it is an example of lots of interesting multi-phase communications, like request-response exchanges.)

Let's write a simple server process that wraps some state. We'll say that it needs to receive commands on one channel and make part of its data available over another channel:

```javascript
let OurServer = (state) => {
  let commandCh = new Channel
  let dataCh = new Channel

  let loop = (state) => {
    select {
      case command = receive(commandCh):
        loop(executeCommand(command, state))
      case send(dataCh, state.dataToShare):
        loop(state)
    }
  }
  spawn () => loop(startState)

  return {
    getData: () => receive(dataCh),
    sendCommand: (command) => send(commandCh, command)
  }
}
```

The server thread loops forever, continually ready to either receive a command or send some of its data. Again, all the details of the internal communication are abstracted away from client threads, who only have access to the interface functions.

Now let's add what should be a simple requirement: the server should also be able to participate in a swap operation. Just like receiving commands and sending data, the swap should be available every step through the loop. Like any other operation used in a select, it should complete if it's the first operation to find a partner, but otherwise let the existing send and receive operations carry out their responsibilities.

What we would like is to write a select statement like this:

```javascript
select {
  case command = receive(commandCh):
    loop(executeCommand(command, state))
  case send(dataCh, state):
    loop(state)
  case value = swap(state.dataToSwap):
    // do something with the value
    loop(state)
}
```

Unfortunately, in languages that have channel operations but not synchronizable abstractions, this isn't possible. To see why, let's examine the semantics of our select/case syntax. Our case statements look like they contain function calls to receive and send, but they clearly can't be executed that way. Whichever was called first would block until it had been completed. Instead, select must be implemented by gathering descriptions of all the possible communications in the case statements, then offering all of them at the same time, and finally blocking until the first one completes.

Because select needs to introspect on the communications in its case statements, it doesn't know what to make of our call to swap, which is just a variable holding a function we wrote. The select syntax can't "see into" our function and get the description of its desired communication to offer it in parallel with the other case statements.

This is a limitation of most languages with channel-based concurrency. We can build new communication protocols on top of channels, like swap. And we can use functions to abstract their details from clients. But we can only abstract over the *execution* of our protocol. We can't abstract the *description* of the protocol, such that it can be composed with other operations via select.

If we're stuck in such a language and really need to both swap and perform other operations, we have a few choices:

- We can spawn a separate thread to only perform the swaps. This child thread loops forever: first receiving a message with the server's current state, and then offering that as a swap. But when it swaps, the child thread may hold an out-of-date version of the parent's state. So this solution enables us to compose our swap abstraction into a larger process, but only by trading away safety and understanding.
- A more common solution is to break the encapsulation of our swap abstraction and inline its operations into our server thread:

```javascript
select {
  let replyCh = new Channel
  case command = receive(commandCh):
    loop(executeCommand(command, state))
  case send(dataCh, state):
    loop(state)
  // inline the definition of swap:
  case send(swapCh, [replyCh, state.dataToSwap]):
    let newValue = receive(replyCh)
    loop(state)
  case [replyCh, newValue] = receive(swapCh):
    // do something with newValue
    loop(state)
}
```

Now we have a server that is the composition of sending, receiving, and swapping values. But in order to compose it with other operations, we had to eliminate the abstraction around swap. The raw channel used for the protocol is now exposed to client threads that have to re-implement its steps, and might get it wrong in unsafe ways. At minimum we have lost encapsulation, but in all likelihood we've also lost safety.

### Imagining our way out of the problem

Let's stop and look at our problem. We would like to be able to build our own concurrent protocols that are encapsulated, easy to reason about, and also composable. The current language lets us abstract over the *execution* of our protocol, but not over a *description* of it that could be composed just like select can compose simple channel sends and receives.

What we need is a way to use *possible* communications as values, separate from executing them. Then our swap operation could just return a value that could be composed into a select statement.

Our possible communication values need a shorter name. We'll call them *events*. Let's imagine what we need from events:

- First, we need versions of send and receive that don't perform the operation but just return a description that can be performed later. We'll call those `sendEv` and `receiveEv`.
- Next, we need ways of combining events together. For example, our swap function needs to return an event that represents its current select statement, the alternative between two events. We'll call that `selectEv`.
- Because `selectEv` receives event values, it can be a normal function rather than custom syntax. But to fully replace select/case, we also need a way to express the idea that certain statements should be executed if an event actually occurs. We'll call that combinator `wrap`.
- Our swap function returns an event value, which might be used and reused multiple times. So instead of creating a private channel when the event is built, we need to create a new one every time the event is used in a communication. We can do exactly this with `guard`, which wraps an event-generating function and returns an event that calls that function every time it is used in a communication.

Here is our swap protocol with those changes so that it returns an event:

```javascript
let SwapChannel = () => {
  let ch = new Channel();
  return (value) => guard(() => {
    let replyCh = new Channel();
    return selectEv([
      wrap(receiveEv(ch), ([newValue, replyCh]) => {
        send(replyCh, value)
        return newValue
      }),
      wrap(sendEv(ch, [value, replyCh]), () => {
        return receive(replyCh)
      })
    ])
  })
}
```

We changed a few function names, swapped our custom syntax for function callbacks, and otherwise changed very little. Client threads can now call the returned function to get an event that describes how to conduct the operation.

Next, we need to actually *execute* our events. We can call sync on an event to execute it, blocking until it succeeds. A very common pattern is to call `selectEv` on an array of events and then sync on the resulting single event. So we'll give that combination a shorter name: `select` (which is no longer needed as a keyword).

Using our new event-returning swap operation and a select call to actually execute it, we can now write our original server exactly as we wanted to:

```javascript
let OurServer = (state, swapEv) => {
  let commandCh = new Channel
  let dataCh = new Channel
  let loop = (state) => {
    select([
      wrap(receiveEv(commandCh), (command) =>
        loop(executeCommand(command, state)),
      wrap(sendEv(dataCh, state), () =>
        loop(state),
      wrap(swapEv(state.dataToSwap), (received) =>
        loop(doSomething(state, received))
    ])
  }

  spawn () => loop(startState)

  return {
    getDataEv: () => receiveEv(dataCh),
    sendCommandEv: (command) => sendEv(commandCh, command)
  }
}
```

When we started this section, we had an abstract and correct swap protocol. But limited to the language of channels, we couldn't compose it with any other operation. We imagined a new type of value, the event, that could *describe* our protocol without executing it. Rewriting swap in terms of events, we were able to retain its encapsulation and safety while also being able to compose it with other events.

By now you've guessed it: the new *event* values that we imagined are the core primitive of synchronizable abstractions.

## Synchronizable abstractions

We've already seen that an event is a description of a possible communication. We've also seen that some events aren't just single operations, but instead encapsulate complex logic about multiple steps and alternatives.

The lifecycle of an event has three distinct moments:

1. An event value is *constructed* and may encapsulate references to various channels, alternatives, and callbacks.
2. Next it is *sync*ed, that is: offered to the system as an available operation in search of a partner. When we sync a compound event, all of its alternatives are synced at the same time.
3. Finally, if the event *succeeds*, then its communication was carried out and it returns a value representing what was communicated. Alternately, it *fails* and is not carried out. Each time a compound event is synced, exactly one of its children succeeds, while the rest fail.

Now that we know *what* an event is and *when* its different parts occur, we may ask *how* do we build programs from events. Ancient wisdom suggests we should ask three questions: What primitive events are there? How can we combine them together into more complex events? What means of abstraction do we have?

### Primitives

- We've already used `sendEv(ch, value)` and `receiveEv(ch)` to build events representing channel sends and receives. When executed, a send has a result of nothing, while receive results in the value received.
- Waiting on a promise or MVar, with the result of the value that it wraps.
- Waiting for a semaphore to not be blocking.
- System-level I/O, including reading and writing to disk, or sending and receiving messages from the network.
- The CML implementation also includes useful primitive events like `never` (which never succeeds) and `always(value)` (which is always available and may succeed with the given value).

### Combinators

- `selectEv` takes a list of child events and returns a new parent event. When the parent is synced, it syncs all of its children, but only one of them can possibly succeed. The parent event then succeeds with the value of whichever child succeeded.
- We can use `guard(callback)` to build an event that will be initialized later. When the resulting event is synced, the callback is called and should return a new event, which will actually be used. This is useful if we want to do work when our event is first offered to the system, like sending a setup message and then waiting for a response, or initializing variables relative to the sync time. A small example is `timeoutEv(secs)`, which represents an event that will be available a certain number of seconds after it is synced.
- We've already used `wrap(ev, callback)`, which returns an event that is synced exactly like `ev` but, if it succeeds, passes its result to the callback and then uses the return value of the callback as the event's result. This is useful to chain together steps in a protocol, as we did in swap.
- The opposite of `wrap` is `wrapAbort(ev, callback)`, which wraps an event with a callback to execute only if the event is synced but fails. If you use `guard` to set up state or send a speculative message, `wrapAbort` is the place to tear it down or cancel it if the event does not succeed.

### Means of abstraction

Unsurprisingly, our means of abstraction is *lambda*, the encapsulation of detail provided by function calls and lexical scope. Indeed, the entire point of synchronizable abstractions is to produce values that can be passed to and returned from lambdas. This allows us to compose operations together while also abstracting their details from each other.

### Infrastructure

One final set of details: our primitives and combinators will only work as promised with appropriate runtime infrastructure to avoid thread starvation or memory leaks. Two key properties of the CML runtime are:

- **Preemptive scheduling**. Rather than allow individual threads to keep working until they block or are finished, the Concurrent ML runtime will interrupt a running thread to make sure others have a chance to execute. The scheduler is also deliberately designed to give enough time to both computation-intensive and communication-intensive threads. **React Fiber** is an attempt to get some of the benefits of preemptive scheduling in JavaScript, which only offers cooperative scheduling. To ensure React doesn't prevent other script from running, it has been re-written so that it can do partial work, stop to let other scripts run, and then resume execution where it left off.
- **Smart garbage collection**. One common Concurrent ML idiom is to spawn a thread that waits on a communication, which may or may not ever occur. It would be quite wasteful if all those threads just sat around in memory, blocking forever. Fortunately, the CML runtime is quite intelligent. If a thread is blocked waiting to read or write to a channel, but no other threads have references to that channel, then both the channel and the blocked thread can be garbage collected. This avoids memory leaks and encourages a style that uses threads and channels for resource allocation and collection.

  This is especially relevant to concurrency in JavaScript. One of the most common sources of bugs in JS apps is long promise chains which then perform some mutation of shared state as their last step. Consider a search widget that fires off an ajax request and then chains that with a setState to show the results. If a user searches for two things in quick succession, they may end up with the wrong results if the first search returns more slowly than the second. This is no different from any other concurrent program written without synchronization. A generic, boilerplate-free solution would be to treat the component and the promise chain as separate "threads" that can only share state via communication. The component would then listen for information from the channel of the most-recently conducted search request. All previous requests could be automatically cancelled and garbage collected, preventing them from interfering with the component's state.

## Resources to learn more

I hope that I have motivated you to learn more about synchronizable abstractions and given you a high-level overview of what awaits you.

To deepen your understanding, I have three suggestions:

- If you have the time, I highly recommend Professor Reppy's book, [*Concurrent Programming in ML*](https://www.amazon.com/dp/0521480892/ref=cm_cr_ryp_prd_ttl_sol_0). It explains the what, why and how of CML from scratch, with both many small examples and several chapter-length case studies of complex applications. (The only prerequisite for this book is learning to read basic ML type and function declarations. Skimming through chapters 1 and 2 of [*Real World OCaml*](https://realworldocaml.org/v1/en/html/index.html) is probably sufficient.)
- If you're more of a Schemer, the chapter "[Concurrency and Synchronization](https://docs.racket-lang.org/guide/concurrency.html)" in The Racket Guide provides an introduction to Racket's embedding of events. This will not give you as thorough an introduction to patterns of event programming, but it does have many short code samples that are useful in understanding specific functions.
- For an example of how synchronizable abstractions can implement complex system behavior, read the paper ["Kill-Safe Synchronization Abstractions"](https://www.cs.utah.edu/plt/publications/pldi04-ff.pdf), which describes an especially clever use of events in the implementation of DrRacket and uses several complex patterns of programming with event composition.

Unfortunately, all of the resources I have seen present programs as finished artifacts. They lack information on *how* to arrive at a correct program, or even exercises to test and expand your knowledge. To remedy this and test my own knowledge, I have started [re-implementing the book's examples](https://github.com/asolove/explore-concurrent-ml) in Reason and writing tests for them. I have learned a lot from this process and assume that doing it in Racket or Guile would be even more educational.

I am also trying to write exercises appropriate for several sections in the CML book and hope to post them soon.

Of course, what the world could really use is *The Synchronized Schemer*, a book presenting a minimal form of events along with commandments and exercises for writing correct concurrent programs. Until that exists, we'll just have to do the best we can with the resources we have.

### Acknowledgements

I would like to thank many people for helping with my education and the content of this post:

- Kris Kowal read an earlier version of this post, provided helpful feedback, and suggested several related ideas worth exploring.
- Several Facebookers whispered about their React-optimization experiments using CML, which was my first introduction to the idea.
- Andy Wingo and Sam Tobin-Hochstadt had [a discussion on Andy's blog about CML's primitives in Guile](https://wingolog.org/archives/2016/09/21/is-go-an-acceptable-cml). This was my first sense that the ideas had broad applicability and were worth adopting outside ML.
- Chris Meiklejohn was up late one night and responded enthusiastically to my tweet asking if reading Reppy's book was worthwhile.

---

<small>*Originally published on [Medium](https://asolove.medium.com/synchronizable-abstractions-for-understandable-concurrency-64ae57cd61d1) in April 2017.*</small>
