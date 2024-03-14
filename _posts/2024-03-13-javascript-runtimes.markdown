---
layout: post
title: Only 20 JavaScript runtimes left
description: Claim yours now before we run out!
date: 2024-03-13 11:28:00
categories: js
---

tl;dr: a new report from our department of experimental linguistics suggests: **there are only 20 JavaScript runtimes left.**

## Context

The rule is: if you are building a new JavaScript runtime, its name must be a permutation of the letters in "Node". (See: Node, Deno, Endo.)

This blog post provides a scientific study of the possible runtimes, a ranking of them by brand name potential, and an estimate for when they will all be claimed.

## Already-claimed names

| Name                                   | Description                                                                                                            |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| [node](https://nodejs.org/en)          | The original: an open-source, cross-platform JavaScript runtime environment.                                           |
| [deno](https://deno.com/)              | Deno is the most productive, secure, and performant JavaScript runtime for the modern programmer.                      |
| [endo](https://github.com/endojs/endo) | A JavaScript platform ... for secure communication among objects ... distributed between mutually suspicious machines. |
| [deon](https://github.com/plurid/deon) | Not a JS runtime, but there is already a JSON-like notation format of this name, so we can't use this name             |

## Available names

That leaves us with 20 available permutations. Many of them would make quite poor names, so I've ranked them here in order by how strong I think the brand opportunity is.

**Plausible names**

| Name | Brand possibilities                                                                                                                       |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------- | --- |
| oden | Strong mythology/comics reference possibilities here for logo branding.                                                                   |
| nedo | Pronounce it "Neato!"                                                                                                                     |
| edno | Pronounce it "Edna" and make this a Simpsons reference to Edna Krabappel and you've got a string brand and a cease-and-desist opportunity |     |
| doen | Pronounce it "Doin'"                                                                                                                      |
| edon | As in "Garden of": a fresh perspective where no evil exists (get rid of casts)                                                            |
| oned | 1d, as in, one-dimensional. A JavaScript-to-wasm runtime where 1d is a joke on linear memory                                              |
| neod | A daemon runner for elite hackers who are trying to find out the truth about the matrix                                                   |

**Hard-to-use names**

<small>dneo
dnoe
edon
enod
eodn
ndeo
ndoe
noed
odne
oedn
oend
onde
</small>

**An important point**

I hope the developer community will show some restaint and claim all of those 19 available permutations first.

Then, the final JavaScript runtime can claim the name `done`.

## Exhaustion estimate

We can do a quick curve-fitting exercise on the available data:

| Year | Runtimes | Event                     |
| ---- | -------- | ------------------------- |
| 2009 | 1        | Node first public release |
| 2018 | 2        | Deno first public release |
| 2019 | 3        | Endo first demo           |

To see that we can expect all 24 permutations to be claimed by 2029:

![Graph showing trend line of JS implementations over time. 2009: 1, 2018: 2, 2019: 3. Suggests all 24 runtimes will exist by 2029.](/img/js-runtimes-trend.png)

---

## If you got this far

You might like some of my more serious writing for JavaScript people:

- [Pure UI Control](https://asolove.medium.com/pure-ui-control-ac8d1be97a8d): an essay about how and why to work in state machines for UI.
- [Synchronizable abstractions for understandable concurrency](https://asolove.medium.com/synchronizable-abstractions-for-understandable-concurrency-64ae57cd61d1): an explanation of the Concurrent ML primitives for UI programming.

---

## Errata

- Thanks to A. Gupta for correcting several mistakes with regard to names that I had claimed were not usable but which did in fact have good branding potential.

<small>So help me, do not send me emails about this post. I do not want to know your thoughts. If you have corrections, please file them directly to the HN comments section.</small>
