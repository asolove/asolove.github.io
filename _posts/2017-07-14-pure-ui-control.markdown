---
layout: post
title: "Pure UI control"
description: "This month marks 10 years that I’ve been paid to build web user interfaces. And today is the second anniversary of Guillermo Rauch’s essay…"
date: 2017-07-14 09:00:00
categories: js ui
---

This month marks 10 years that I’ve been paid to build web user interfaces. And today is the second anniversary of Guillermo Rauch’s essay [Pure UI](https://rauchg.com/2015/pure-ui). Those two anniversaries have led me to reflect on the past and future of UI development.

The past 10 years has seen major improvements in how cross-discipline teams work together to create interfaces. We are much better at thinking about all the different ways an interface should display, depending on the user, their data, their device, and other context.

In contrast, we still struggle to understand how complex interfaces behave given all the possible ways that users interact with them. Most interfaces still have bugs when you interact with them in unexpected ways. Even the developers don’t fully understand their behavior. We can do better.

**Understandable behavior is possible.** We can improve how teams understand a UI’s interactive behavior by following the same strategy that helped us understand complex UI display states.

In this post, I’d like to show that:

- Teams improved at building complex UIs by changing the way they represented and communicated about them.
- Unexpected behavior arises because teams struggle to represent an interface’s desired behavior.
- By adopting the idea of *control state*, teams can gain a powerful way to represent a UI’s interactions and prevent unexpected behavior.

## Understanding display states with Pure UI

In his wonderful essay [Pure UI](https://rauchg.com/2015/pure-ui), Guillermo Rauch described how the React programming model changed his collaboration with designers. The major change is a focus on explicitly describing *display states*. The designer creates an artboard with side-by-side designs of each of the widget’s states. The React code similarly branches on those same states. There is a close correspondence between between each design on the artboard and the code in the `render` method. More importantly, the shared language of states means that when the developer discovers a new possible case, it has a natural place on the design artboard and requires only one new bit of thought from both design and development.

This way of working is now so natural that it’s easy to forget that it wasn’t always obvious. To see the difference, let’s consider how designers and developers worked together when I started building web UIs ten years ago.

The design was a Photoshop file with just a single state of the screen visible. A thoughtful designer might have considered a few other states and put them in layer groups to be switched on and off. But many other states were ignored or described only in informal conversation, as changes to be made to the original state. The secondary states never took on visual form and were therefore a frequent topic of miscommunication.

The code for the widget consisted of a template, and then a series of functions that described how to modify the displayed DOM in response to various user inputs or data changes.

These design and code representations share two features:

- Different states of the application can be viewed only one at a time, and require careful manipulation to reach.
- There is no explicit list of possible states.

These features make it hard for the team to think and communicate about the interface:

- There’s no easy way to see all the states at once, so it’s difficult to hold the interface as a whole in your head.
- Without an explicit list of states, it’s easy to incorrectly judge progress if the default state looks finished.
- When developers discover a new state, it doesn’t have a natural place in the design document, so often isn’t designed at all.
- Adding a new design element to the interface becomes progressively harder because every transition method needs to consider whether it should show, hide, or make changes to every element.

Notice that these aren’t primarily technical or process problems. They’re thinking problems. The design and the code describe a component as a default visual display and a set of changes that can be applied to it. But these representations don’t help us communicate across disciplines, identify questions that we still need to answer, or simplify the work itself.

The Pure UI approach improved our thinking and communication by first changing the way we represented display states. Now we describe a component as a set of states that each have their own visual display. This description provides a natural mapping between the designer’s artboard and the developer’s style guide. Both of these artifacts allow us see all the states side-by-side, so we can think about them as a whole and notice inconsistencies and open questions. They also make changes atomic and localized: when we make a change to one state, it only affects that state.

Generalizing the lessons of Pure UI, we can see a strategy to apply whenever a problem becomes too complex for teams to think and communicate about together:

- Look for a missing idea not explicitly reflected in the problem’s current representation.
- Find a new representation that makes that idea explicit and helps us represent what we know and what we still need to think through.
- Then, only at the end, worry about the technology and process to use to bring this representation to life.

Keep that strategy in mind as we consider the problem that many UI teams currently struggle with: understanding all the possible interactive behaviors of their application.

## The problem of unexpected behavior

For as long as I’ve built interfaces, regardless of the technology or testing plan, we’ve found unexpected behavior in production. Nothing obvious, certainly nothing that anyone would have written a user story about.

Instead, the bugs came up in unexpected cases that made you wonder “why would anyone do *that*?” But if it’s possible to do something, someone eventually will. What almost all of these bugs had in common was a dependence on *ordering *and *cases*, especially *unexpected *orders of cases.

You’ve probably experienced bugs like these in your own projects:

- The credit card validation widget stops working if you enter half of a card number, switch to another screen in the application, do something there, and then switch back to the payment screen.
- If you’re in the middle of editing one object, click a button to load data about another, and if the timing of the response is just right, your edits may be saved to the wrong one. Or lost forever.

Sometimes I see teams blame these problems on their own bad code, `redux-thunk`, or some other bit of technology. But it isn’t asynchronous tools or lazy developers that create these problems. It’s true that once you understand how the bug can happen, it’s obvious that the code is wrong. But when writing the code, would a reasonable developer have thought to handle this case? Did a designer consider this possibility and what should happen?

Usually not.

So we don’t have a technology or laziness problem, we have a thinking problem. We need representations that can help us think about an interface’s behavior.

<figure class="margin">
  <img src="/img/pure-ui-control/pure-ui-control-b7baa454.png" alt="Desktop UI calculator with number and operation buttons and a display for values.">
</figure>

Let’s consider a simple calculator application. It has only one display state, but a surprising depth of behavior. Everyone knows in general what it should do, but unless you’ve sat down to think about it, you likely don’t know *how* it should do it. It’s trickier than it looks.

You probably don’t believe me. You think you could turn this out in five minutes. I encourage you to go try. (Please leave a comment here with a link to the code and how long it took.)

Let’s examine the artifacts that a UI team would use to think about this interface:

A designer, after producing one simple mockup, might stop there. If very thoughtful, they might write a few sentences about the expected behavior for a few sequences of input.

The developer will quickly get the display and events hooked up. I’ll assume they use a pattern like Redux or the Elm architecture where they need to define a function that takes the current state and an action and returns a new state.

- First they implement an action for the digits. A simple implementation just multiplies the existing value by 10 and adds the new digit.
- Next they implement the decimal action. This doesn’t immediately change the numerical value but does need to show up on the display. So perhaps they add a new `decimalPressed` flag to the state. It’s set to true when decimal is pressed, and it causes the decimal point to show on the display even if the current value is integral. After this, the sequence of actions `2 0 .` correctly shows `20.` on the display.
- Ah, but now a problem. When the `decimalPressed` flag is set to true, the existing handler for typing a digit is wrong. So any action that changes the number needs to check the flag. Oh, and any action that means we’re starting to type a new number needs to remember to set it back to false. Well, unless we pressed decimal right before the digit, then it should stay true. …

There are better and worse ways to implement the complete logic and I don’t want to walk through the whole problem. The naive strategy is to slowly add flags and other non-visible bits of state to represent what each action needs to know about the history of past actions. This is workable, but creates problems:

- Adding new actions becomes progressively harder because they may need to react to arbitrary previous actions or influence arbitrary future ones. It’s not clear which combinations you need to consider, or when you’re done.
- The nested conditions in the code don’t clearly match to any other representation, so code itself becomes the definition of correctness. It becomes difficult for designers, or anyone else, to have opinions about what should happen in any particular case.
- There’s no way to know if you’re done. Unit tests can cover cases you think about. But there are infinite possible orderings of events, so can they cover everything?

Clearly this is not a technical problem, but a thinking one. In particular, the representation of behavior as prose or reducer code doesn’t help us to think about the problem or check our understanding. Just as in the case of Pure UI’s display states, we need a new organizing idea and a new representation to aid our understanding.

## Data state & control state

I think the idea we’re missing is an application’s *control states*. Previously we enumerated all of an interface’s *display states* as all the meaningfully different ways it should display. A *control state *is all the possible states of the interface that have different sets of allowed interactions. Sometimes the two layers of states align, as in a loading state that displays a spinner and ignores all user input. In other cases, an interface’s display state can remain the same even while it’s control state changes.

Consider the calculator. When its display reads `20`, it may actually be in one of two control states. In the “Entering operand” control state, typing another digit appends it to the end of the current number. In the “Result” control state (where a previously-calculated answer is shown), typing a digit causes it to be the start of a new operand, and transitions the control state to “Entering operand,” changing how the next action will be interpreted.

<figure>
  <img src="/img/pure-ui-control/pure-ui-control-318a3137.jpg" alt="The high-level statechart for the calculator application. © Addison Wessley. From Ian Horrocks’ “Constructing the User Interface with Statecharts”, p215">
  <figcaption>The high-level statechart for the calculator application. © Addison Wessley. From Ian Horrocks’ “Constructing the User Interface with Statecharts”, p215.</figcaption>
</figure>

With the new idea of control state, we can proceed just as we did before, by imagining sequences of inputs and asking what the interface should be able to respond to next. But now we can take what we learn and make it into an enumerated set of all the allowed control states and how they respond to user actions.

Thinking about our interface’s behavior in terms of control states also makes it possible to produce more understandable artifacts. Non-programmers can easily follow a state transition diagram like the one at left for the calculator. Even for programmers, the visual structure of the chart may provide a high-level “aha!” understanding of what the interface really allows.

Control states also can be naturally represented in our code. No longer should we define a single handler for each button, with lots of cases inside it depending on the action history. Instead, transitions are defined for a specific pair of the current control state and the action.

If your language supports some kind of pattern matching, this can turn into quite lovely code. Below is part of an implementation of the calculator’s control states in [Reason](http://facebook.github.io/reason/). Each line communicates how a specific control state reacts to a specific action by returning a new control state.

(*An aside to Reason aficionados: *Notice an extra benefit of this structure, that each control state requires a specific, typed set of context data. This ensures that each state can only rely on data it is guaranteed to have, and that on leaving one state, any no-longer-active data is discarded and re-initialized when the state is re-entered. You may enjoy reading [the full code](https://github.com/asolove/restate/blob/c93fb84ea6bf39fb9722cd7593ac7c636d35c9e1/motivation/naive/calculator_state.re#L43).)

<figure>
  <img src="/img/pure-ui-control/pure-ui-control-d7d67a83.jpg" alt="Reason code for the Calculator transitions. See accessible text version at the link just before this image.">
</figure>

You don’t have to understand the details of Reason as a language to see that this code, even if translated to your language of choice, maps quite naturally to the diagram above. If a designer adds a new line to the diagram, it corresponds clearly to one spot in the code. And if a developer adds a new transition in the code, it has a natural place on the diagram.

There is still a lot of thought required in the design of the control states. But they provide an organizing structure that allows for more natural representations of our thought. As a result, questions that used to require detailed thought can be reduced to simple visual perception. Cases that developers previously struggled to explain to designers now just require pointing.

The team can *think together* about their interface’s behavior.

## Summary

Over the past few years, web teams have adopted new state-centric representations for their design work. These representations made it easier to think about what an interface should look like depending on data and user context.

Despite that new way of working, most interfaces still have unexpected behavior when subjected to all the possible permutations of user interaction. Teams have no way to represent all these possibilities or to communicate about all the different ways their application needs to respond to sequences of input.

To solve this problem, teams can adopt the notion of *control state* as a description of all the states the interface can be in from the perspective of how it will respond to user interactions. By explicitly designing the graph of control states, they can arrive at an understandable, finite set of behaviors that the application needs to exhibit. With a consciously-designed control state space, teams can more easily reason about what they create together.

### Any questions?

*The calculator is a simple example: does this approach scale to larger interfaces? *With simple state machines, things quickly grow too complicated. But a more powerful formalism, statecharts, can model more complex systems by allowing them to be decomposed into hierarchies (just like components, hmm…) and to represent several charts that can proceed concurrently with one another. Statecharts are a common method for modeling complex embedded software that has many more inputs, and less room for error, than our interfaces.

*What are the semantics of the diagram? How are control states best encoded in my language/framework? *I don’t know! I think there are lots of possible ways to use the idea of control states, just as there are many concrete ways that teams use display states to organize their work.

*That’s it? You wrote 2000 words to tell us about state machines? *Well, sort of. First, because many web developers don’t have a CS background, so just saying “state machines” doesn’t help them. Second, because I wanted to talk about the idea on a non-technical level. The benefit of statecharts comes from using them as a representation to aid cross-discipline thinking and communication. And hey, maybe hearing about it from a different angle will help developers, too.

### Notes

- I am very thankful to [Kevin Lynagh](https://medium.com/u/9a6e84e34ca9), who started bugging me about the idea of using statecharts in UI development almost three years ago. Despite my slow uptake, he kept raising the topic until I saw its value.
- The calculator example and the statechart for its behavior come from Ian Horrocks’ book [*Constructing the User Interface with Statecharts*](https://www.amazon.com/Constructing-User-Interface-Statecharts-Horrocks/dp/0201342782). The book was written in 1999, but his complaints about the poor technical design and confusing behavior of most UIs read like a complaint about web development in 2017. I hope we can improve before another 18 years pass.
- The idea of focusing on how teams communicate and represent their work came from a happy coincidence. I reread “[Pure UI](https://rauchg.com/2015/pure-ui)”, for which I am very grateful to Guillermo, at the same time that I was reading Edwin Hutchins’ [*Cognition in the Wild*](https://mitpress.mit.edu/books/cognition-wild). Hutchins’ book is a critique of traditional cognitive science, arguing that humans mostly don’t use their critical thinking skills to solve problems. Instead, we adopt tools and representations that allow groups of people to solve what would be very complex cognitive problems with fairly minimal use of abstract reasoning. That critique could easily be pointed to normal discussion of programming. We praise the individual who by sheer force of thought arrives at a full understanding of a topic. But often all that effort would be avoidable with a good architecture diagram. I saw that the effect of Pure UI was to replace what had been a large amount of abstract thought with a more convenient representation. This led naturally to the question: what representation would help us understand behavior?

---

<small>*Originally published on [Medium](https://asolove.medium.com/pure-ui-control-ac8d1be97a8d).*</small>
