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

If a single individual is going to do all of this, they will not necessarily proceed in a linear order. Instead, they'll make a meandering path through making decisions at each level of work. Maybe they start with a product vision that seems good, and so the next step is to research the audience and how they might reach them. Based on the learnings there, they start writing some code, which in turn teaches them a bit more about what the product should be, which leads them to refine the marketing pitch, etc.

When multiple people need to work together, they commonly define roles and responsibilities. They need some working agreement for what each of them can do independently, what requires consultation with others, and who needs to be involved if a decision in one of the buckets of work requires changes to another.

## Roles as buckets of work

TODO: image of people sitting in chairs, handing off work from one to the next (assembly line?)

**The most straightforward approach** is to define roles corresponding to each bucket of work. You have a marketing person do marketing work, a frontend engineer build the UI, a backend engineer build the storage and API layer, etc. Each role corresponds to one part of the solution domain, one way of thinking, and one artifact.

For each pair of roles that need to interact, there is a contract between them:

- Product and design communicate via wireframes.
- Design and frontend communicate via mockups.
- Frontend and backend interact via an API contract.
- Backend and ops interact through deploy handoffs.

If we design our roles this way, the pain points will be in the contracts. Each role has its own separate domain of work and forms its own mental model of the work, so that things might not line up in the end:

- Sales closes a deal by promising a feature we don't have, then hands it off to product to figure out how to make it happen in time. Or product stops listening to sales requests and keeps building for an imagined customer that doesn't exist.
- Design hands off a beautiful mockup that hasn't considered all the edge-cases and will be harder than necessary to build. Or frontend just ignores large parts of the design and ships something easier but worse for customers.
- Backend designs an API that is conceptually clear in terms of lower-level entities in the code but not user intend, so the UI has to paper over it poorly. Or: the UI team insists on an API design that is convenient for them but not coherent, so the backend has to paper over it in the other direction.
- Ops deprecates something everyone depends on because it's hard to maintain, but don't have a suggested replacement because they don't understand what real users need it for.

While there are extreme forms of these behaviors that involve deliberate selfishness, more frequently they are well-intentioned misunderstandings that arise from working in different problem domains and not being able to predict how work in one area will translate into another.

## Unicorn roles

When the pain points of one handoff became strong enough, it becomes tempting to simply combine multiple buckets of work and hire a unicorn who can do both well. In the past ten years, we've seen two common examples of this:

- **Fullstack engineering**: as UIs get more complicated and add stronger demands on the backend, it becomes more painful to separate the work of deciding what APIs we need, designing them, building them, and then calling them from the UI. So it is convenient to simply combine the two concerns. We combine them at the people level by hiring fullstack engineers who can build the APIs they need to build a UI. And we combine them at the technical level: by consolidating onto a tech stack like JavaScript that we can use in both domains, or by promoting the contract into its own generic system, like GraphQL, so that the backend and frontend systems don't have to do custom design work for the others' needs.

- **DevOps**: as backend systems scale and change at higher rates, and our ops choices also change faster and grow more nuanced, it becomes difficult for one person to write the code and someone else to operate it at scale. So it becomes convenient to make the same people responsible for both.

Some of these transformations are useful in some contexts, but they also make it harder to find someone who can independently do both sides equally well. And these combinations can also spread out into impossible combinations: if our organization likes both the "fullstack" and "devops" ideas, we may end up needing to hire a single person who is responsible for UI, backend, and systems. This becomes impossible if we have challenging problems at each of those layers.

## Half a set over roles

An alternative is to leave the same number of roles, but move them half a seat over, so that each role corresponds to one of the previous handoffs rather than to a bucket of work. In this model, each role is responsible for translating needs between two different domains and being competent at each of them. They collaborate with folks on each side to make sure the work at each layer is excellent.

As one example, this might look like:

- A Product Marketing Manager who divides their time between marketing/selling to users and then specifying high-level product requirements.
- A Product Engineer who knows the business context well enough to work with the PMM on product specification and knows the technical context well enough to make a technical plan and do some of the user-facing work.
- A Designer Who Codes (or Design Engineer) who can work from product and user context to combine existing design components in the right way for a specific product flow.
- A Platform Engineer who builds internal services as products for other teams to rely on, so that they don't have to do devops from scratch.

TODO

-
- Reference Pure UI Control about sociology of
- Intro and conclusion
