---
layout: post
title:  "Modeling business problems with ADTs in Flow/js"
date:   2016-04-13 21:43:39
categories: js flow type
---

(Inspired by reading [Julia Evans’ blog](http://jvns.ca) for the past few months, I’m going to try posting about the things I don’t know very well and my own attempts to learn more about them.)

Today I want to talk about a data modeling problem where I often disliked the solution I used in ORM-based web apps, the related-bag-of-attributes problem. And I'll walk through one solution, doing case analysis and modeling the data as an abstract data type. And I'll show a little of the details of doing this in JavaScript, building and type-checking the use of ADTs using [Flow.js](http://flowtype.org).

## The bag-of-attributes problem

I recently had to write some logic that suffered from an antipattern most ORM users will be familiar with: the big bag of attributes problem. You can tell you have this antipattern when a table has many nullable attributes, but some of them are related to others in ways the schema can’t express. Like: all of these are nullable, but exactly one of them must be populated. Or if this one is populated, this one also has to be. Factories and validations can help with this, but at the end of the day I usually ended up with a model with a bunch of attributes, a bunch of random `is_case_a?` helper methods, and one big ugly handler.

Here’s a simple example of a schema with this issue. Imagine we’re a book shop and we need to store enough data to know how much to charge someone for a book. We have a big bag of attributes related to pricing in the books table:

<pre>pages: optional number
price_per_page: optional number
manual_price: optional number
discount_percent: optional number
markup: optional number</pre>

There are some invariants here that the db schema doesn’t enforce. If manual_price is null, then pages and price_per_page must be present. It’s not obvious in which order to apply the discount and the markup, or whether they should even be used if you have a manual_price.

Although it looks crazy now, this example could easily have happened entirely through well-intentioned changes. It started as a book store that just charged different categories of books a different amount per page. But certain rare or signed books were too cheap, so they got a manually assigned higher price to use instead. Later, some books had been sitting around too long, so they got a percentage discount off whatever other price they had. And still later we allowed people to consign books to the shop for a markup percentage and had to track that, too. I’ve seen cases of much worse where more and more attributes pile up all just to provide data for different cases of one calculation.

Now, no one would think an object like this looks like good OOP design. A proper design might instead have a single PricingStrategy interface with several implementations, some of them recursively using other strategies: like `PricePerPageStrategy(pages, price_per_page)` and `DiscountPriceStrategy(discount, pricing_strategy)`.

But persisting data in that shape (a recursive tree with different types at each node) is not particularly easy with an ORM. You could do it with STI, but it wouldn’t be fun, and making it performant (with [nested sets](https://en.wikipedia.org/wiki/Nested_set_model)?) would be a pain. So while you might model business data that is inherently a tree (like reporting relationships) this way, you wouldn’t want to use it for every bit of data that happens to have alternate, recursive strategies.

Instead, you flatten it into one table with a bunch of optional attributes and use factories and methods to guarantee invariants about which attributes have to appear together. And you write one very-well unit-tested method to do the calculation in the exact right order and hope you don’t have to touch it for a while.

## The background

Most of the systems I’ve built have had a single database as the source of truth, with object-oriented models to provide a nice interface and guarantee invariants, and an ORM sitting between them. While this approach has its downsides (one specific example shortly), there’s a good body of practice about how to model different types of problems and do specific technical things like validation, data migration, and optimization.

But now I’m working on a system with several sources of data, several running applications, and aspirations to have more of both. And I’m trying to build some shared logic that can work across environments or with different sources of data. This is new and scary territory to me and I’ve made a bunch of mistakes. 

And it was thinking about that problem that reminded me of Yaron Minsky’s great talk [Effective Ocaml](https://vimeo.com/14313378), which has several pieces of advice about modeling problems in a way that makes it possible for the type system to check that the data makes sense and even to make it more obvious what the code should do with the data. The use of ADTs, pattern matching, and exhaustiveness checking stood out to me as really useful. I have have a problem where I want to add a new case to some data, and it would be amazing if the type checker could not just tell me what I’ve broken, but actively guide me to all the code I will need to touch to make sure my new case is handled everywhere.

I remember watching that talk several years ago and thinking “Well that’s great but I’m never going to get paid to write ML, so whatevs” (Groan. Wish I had stuck with any of the ten times I tried to get into ML or Haskell before.) 

## Reshaping the data to ADTs in Flow

But, as yet another demonstration that nothing exists until it exists in JavaScript, almost everything described in that OCaml talk is doable right now with Flow and JavaScript. (And not by accident. Flow is written in OCaml. Presumably its authors have experience with the patterns Yaron mentions and more.)

Flow provides an extra syntax on top of JavaScript for providing type annotations, plus a very smart type checker that can analyze the code for potential problems.

Here's a small example from the Flow home page:

```js
// @flow
function bar(x: string, y: number): string {
    return x.length * y;
}
bar('Hello', 42); // Flow type checking would fail, saying you can't multiply a number and string
```

But Flow provides a lot more power than just testing basic types. IMO the most important feature is ["tagged unions"](http://flowtype.org/docs/dynamic-type-tests.html#tagged-unions), which let you create and compose data as powerfully as ADTs in ML and Haskell, but with plain JavaScript objects that can be serialized to json.

In the book pricing example, we could create different types to model each way of pricing a book. Each type has the data it needs plus a string that tags which case it is:

```js
type ManualPricing = { type: ‘manual’, price: number };
type PagesPricing = { type: ‘pages’, pages: number, price_per_page: number };
type DiscountPricing = { type: ‘discount’, percent: number, basePricing: Pricing };
type MarkupPricing = { type: ‘markup’, amount: number, basePricing: Pricing };
```

The string tags for each case are necessary because the Flow types only exist at type checking time. In the runtime code that branches by which type of pricing we have, you need some way to test it. By providing the type strings, Flow can also be smart about checking whether your branching code has handled all the possible cases. (The Flow docs about [Tagged Unions](http://flowtype.org/docs/dynamic-type-tests.html#tagged-unions) show a good example of this.)

So these are all the different cases. And we can create a single type that is just the union of all these, meaning that a Pricing can be any of them:

```js
type Pricing = ManualPricing | PagesPricing | DiscountPricing | MarkupPricing;
```

The discount and markup prices take a nested Pricing that they are applied on top of. So you can apply a discount or markup to any other pricing that you have, and the order of nesting of the data structures makes clear in which order they get applied.

And writing the implementation of calculating the price is obvious:

```js
function price(pricing: Pricing): number {
  if (pricing.type === 'manual') {
    return pricing.price;
  } else if (pricing.type === 'pages') {
    return pricing.pages * pricing.price_per_page;
  } else if (pricing.type === 'discount') {
    return price(pricing.basePricing) * (1-pricing.percent);
  } else if (pricing.type === 'markup') {
    return price(pricing.basePricing) + pricing.amount;
  } else {
    // NB: this else case is required for the code to type check.
    // It seems crazy/invalid. But there's an interesting reason.
    // Come back for the next post where I'll try to learn why.
    return pricing;
  }
}
```

What does this get us? Well, a few things:

1. Each case is super simple and obvious to implement.
2. Flow will enforce that if someone passes us a Pricing object it has to be one of those types and has to have all the data that type needs to do its job.
3. If we ever add a new pricing strategy to the data types, Flow will tell us this code no longer typechecks (since we've ignored a possible type of Pricing), and guide us to implement it here.
4. The code has a nice algebraic completeness to it. It is generic and naturally allows us to do things we didn't even deliberately try to put into it, like being able to apply discounts on top of a markup or the other way around.
5. Even though Flow knows about the types of these objects and can enforce useful things about them, they're ultimately just json-serializable plain objects with properties. So we can send them over the wire, even through intermediaries that know nothing about the ADTs, and they arrive in a way that can benefit from Flow's analysis in another codebase.

Now an application with the original data schema can easily create objects of these types, nested in the order they want. If their business logic says always interpret the books table’s discount as coming after the markup, that’s fine. But if later on they want to send us markups on top of discounts, they can do that and it’ll work fine, because these types are explicit and the code itself is naturally generic.

So ADTs are very useful at representing data that might turn into the bag of attributes/nested strategies antipattern in an ORM-based system.

# More to learn

But there are a lot of things I still need to figure out:

1. Is it useful to try to typecheck across distributed applications? It would be great if I could add a new case to the data in one place and be told all the other places elsewhere that needed to be updated to handle it. (I think the Erlang community with its type checker, Dialyzer, would be a good place to learn more about the benefits and limitations here.) Or should I instead use the types as contracts (there’s a way to do this with Flow type declarations: https://github.com/seanhess/runtime-types) to just check that things are sane at runtime?

2. Flow itself has some interesting corner cases or limitations and I would love to understand more about how it works. I evenly mistakenly referred to a few known limitations as bugs on Twitter and GitHub Issues. Sorry, Flow team! Turns out static analysis is really hard even in cases where it’s easy for a human. I want to write a longer post later about the way Flow handles exhaustiveness checking for union types, which has a couple tricky issues and a not documented workaround.

3. While this one problem has a nice solution, I bet there are lots of other ways that the business data could be better represented in a way that lets the type checker help us with current safety and future openness to change. Are there more advanced resources than the “Effective Ocaml” talk on modeling business problems in ADTs and higher-order types?
