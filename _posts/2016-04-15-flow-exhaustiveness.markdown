---
layout: post
title:  "Exhaustiveness checking in Flow"
date:   2016-04-15 21:43:39
categories: js flow type
---

[Last time](/js/flow/type/2016/04/13/modeling-with-adts.html) I wrote about using Algebraic Data Types and Flow's type checker to model business problems in JavaScript.

Today I'd like to talk about exhaustiveness checking on ADTs, an unexpected limitation in Flow that makes it difficult, and a workaround that doesn't seem to be very well known.

## Exhaustiveness checking

One of the benefits of ADTs and type checkers is "exhaustiveness checking": automatically making sure that we've covered all of the possible cases anywhere that we interact with a piece of data.

I first learned about this from Yaron Minsky's advice "Code for exhaustiveness" in his talk Effective ML. It's worth a few minutes to watch that section:

<iframe width="560" height="315" src="https://www.youtube.com/embed/DM2hEBwEWPc?t=28m30s" frameborder="0" allowfullscreen></iframe>

I've written and thought about if statements for some huge number of hours in my life. But the idea he presents here still blows my mind. I know all about patterns for writing easily-refactorable code in object-oriented languages, but I had always thought of functional programming as something static and just correct or incorrect when written. The idea that I could write my types and case analysis today in a way that lets me use the type system as a refactoring tool when business requirements change later was really interesting.

# Checking in Flow

I'll start by transcribing the example from the video into JavaScript. The types involved look something like this:

```js
type Order = { type: 'order', id: number }
type Cancel = { type: 'cancel', order_id: number }
type Exec = { type: 'exec', dir: Direction, quantity: number }
type Action = Order | Cancel | Exec
```

Here is the initial version of the code, which is correct now but will continue to type-check even if new, unhandled cases are added to the set of action types:

```js
function positionChange(action: Action): number {
  if(action.type === 'exec') {
    const dir = (action.dir === 'buy' ? 1 : -1);
    return dir * action.quantity;
  } else {
    return 0;
  }
}
```

We might try to write a more future-proof version of the function following the Ocaml example in the talk, like this:

```js
function positionChange(action: Action): number {
  if(action.type === 'exec') {
    const dir = (action.dir === 'buy' ? 1 : -1);
    return dir * action.quantity;
  } else if(action.type === 'order' || action.type === 'cancel') {
    return 0;
  }
}
```

But there is a problem: this doesn't type-check in Flow. Instead, you get an error saying that the function can possibly return undefined, and this does not match the declared return type of number.

Why does it say that? Well, our code returns a number in the `if` and `else if` cases, but nothing if we fall through both of those cases. Even though logically we have covered the three possible types of action, Flow doesn't seem to know this. If you get really curious and look throughout the docs on the Flow site, you'll even notice that all the examples with `if` or `switch` statements use a blanket `else` or `default` case.

But doing that here would be quite unfortunate. After all, if we have to add an `else` or `default` case to everywhere that we match a variant type, we'll run into the original problem we wanted to avoid. Our code will type check now, but it will also type check if we add new variants later, because they'll get caught by the `else` or `default`.

## Saved by a hack

At this point, stymied by my experiments, I turned to the #flowtype IRC channel on Freenode, and a very helpful person by the nick [@marudor](https://twitter.com/marudor) showed me a fantastically hacky workaround.

Before I present the hack, let's back up and describe the problem we have. We want some way to take the code above, and make it type check now, by returning a value that type-checks against number even if we fall through the cases in the current code. But we want that value to no longer type-check against number if we ever add new cases to `Action` that aren't explicitly checked for in the `if` and `else if`.

The Flow docs have a whole page on [Dynamic type tests](http://flowtype.org/docs/dynamic-type-tests.html) that shows how Flow analyzes programs like this. The variable `action` may start out with the type `Action`, but when flow sees that one branch of an `if` statement checks that the variable is one specific type of `Action`, it's smart enough to realize it must be that type within the code in that branch. It also knows that means the uses of `action` later on in other branches of this if statement will not have that type of `Action`. Let's annotate the code with what I think Flow knows:

```js
function positionChange(action: Action): number {
  // action is of type Action, one of (Exec, Order, Cancel)
  if(action.type === 'exec') {
    // action is of type Exec
    const dir = (action.dir === 'buy' ? 1 : -1);
    return dir * action.quantity;
  } // in any later else case of this if, action cannot be an Exec
  else if (action.type === 'order' || action.type === 'cancel') {
    // action is either cancel or order
    return 0;
  }
}
```

So this is how Flow sees the program. Flow also doesn't realize we logically can't fall through both the `if` and the `else if`. That raises the question: if we added an `else` clause after the current `if`/`else if`, what type would `action` have? It started out as an `Action`, but we've now refined it to subtract the possibility of it being `Exec`, `Order`, or `Cancel`. If it can't be any of those three variants, what type does it have?

The answer is : `any`. `Any` is the magic type that every possible JS value can have. It is both the super and sub-type of every other type. It appears that if you refine all the cases off of a type, it curls up and becomes an `any`.

And this turns out to be incredibly useful for our problem. Since `any` checks against any other type, Flow will happily accept it as a number to be returned from our function:

```js
function positionChange(action: Action): number {
  // action is of type Action, one of (Exec, Order, Cancel)
  if(action.type === 'exec') {
    // action is of type Exec
    const dir = (action.dir === 'buy' ? 1 : -1);
    return dir * action.quantity;
  } // in any later else case of this if, action cannot be an Exec
  else if (action.type === 'order' || action.type === 'cancel') {
    // action is either cancel or order
    return 0;
  } else {
    // action is of type any
    return action;
  }
}
```

Even though this case will never be reached in running code, it allows the function to type check. And, because `action` only has type `any` because we have specifically checked for the other three cases, if we ever add another type of action, this function will no longer type check. For example, if we added `Correction` as a variant of `Action`, the use of `action` in the `else` case would still have a possible refinement to `Correction`, so it would not be of type `any`, would not match `number`, and Flow would tell us we needed to explicitly check that case.

Now, this technique has some limitations. For one, it only works if the return value of the function is different from the actual type you're doing case analysis on. If you want to return the same type, the final `else` case would continue to type-check even if you added new cases. Bummer.

So there you go, a crazy hack that lets you get exhaustiveness checking in Flow. Thanks to @marudor for this hack and the Flow devs for all their awesome work. There are already discussions in progress about modifications to variants that would get rid of the need for this hack, so hopefully it will be unnecessary soon.


