---
layout: post
title: Half a seat to the left
description: A pattern for organization design
date: 2024-01-20 11:28:00
categories: people
---

TODO: intro

Imagine we want to build a consumer web product. Whether one person or a hundred are working on it, we still conceptually have the same buckets of work:

- Marketing work: how do we find people who need what we're building? how do we attract them and explain it to them?
- Product work: what is our customers' real problem and how do we solve it for them?
- Frontend work: how do we make the user interface look and behave?
- Backend work: how do we model our data and logic?
- Ops work: where will our code run? how will we make it fast, reliable, and secure?

If a single individual is going to do all of this, they will not necessarily proceed in a linear order. Instead, they'll make decisions at each layer in the order that seems right, tracking down by themselves when a marketing decision requires us to change the UI, or an infra constraint requires us to change the products' features.

When multiple people need to work together, they commonly define roles and responsibilities. They need a way to track what each of them can do independently, what requires consultation with others, and who needs to be involved if a decision in one of the buckets of work requires changes to another.

## TODO: name for this path

TODO: image of people sitting in chairs, handing off work from one to the next (assembly line?)

**The most straightforward approach** is to define roles corresponding to each bucket of work. You have a marketing person do marketing work, a product person do product work, etc. Each role has its domain and way of thinking. For each pair of roles that need to interact, there is a contract between them:

- Product and frontend communicate via wireframes and mockups.
- Frontend and backend interact via an API contract.
- Backend and ops interact through deploy handoffs.

Following this design, the pain points will be in the contracts. Each role has its own separate domain of work and forms its own mental model of the work, so that things don't line up in the end:

- Sales closes a deal by promising a feature we don't have, then hands it off to product to figure out how to make it happen in time. Or product stops listening to sales requests and keeps building for an imagined customer that doesn't exist.
- Design hands off a beautiful mockup that hasn't considered all the edge-cases and will be harder than necessary to build. Or frontend just ignores large parts of the design and ships something easier but worse for customers.
- Backend designs an API that is conceptually clear in terms of lower-level entities in the code, but that doesn't represent actual user needs.
- Ops deprecates something everyone depends on because it's hard to maintain, but don't have a suggested replacement because they don't understand what others use it for.

While there are extreme forms of these behaviors that involve deliberate selfishness, more frequently they are well-intentioned misunderstandings that arise from working in different problem domains and not being able to predict how work in one area will translate into another.

## Unicorn roles

When the pain points of one handoff became strong enough, it becomes tempting to simply combine those two buckets of work and hire someone who can do both well. In the past ten years, we've seen two common examples of this:

- Fullstack engineering: as UIs get more complicated and add stronger demands on the backend, it becomes more painful to separate the work of deciding what APIs we need, designing them, building them, and then calling them from the UI. So it is convenient to simply combine the two concerns. We combine them at the people level by hiring fullstack engineers who can build the APIs they need to build a UI. And we combine them at the technical level: by consolidating onto a tech stack like JavaScript that we can use in both domains, or by reifying the contract into its own generic system, like GraphQL, so that the backend and frontend systems don't have to do custom design work for the others' needs.

- DevOps: as backend systems scale and change at higher rates, and our ops choices also change faster and grow more nuanced, it becomes difficult for one person to write the code and someone else to operate it at scale. So it becomes convenient to make the same people responsible for both.

Whether these transformations are successful or not

## Half a seat over

Let me propose an alternative organizational design: instead of matching roles to buckets of work in their own domain area, match them to the handoffs between the domains.

TODO

-
- Reference Pure UI Control about sociology of
- Intro and conclusion
