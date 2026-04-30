---
layout: post
title: "Preact in pictures"
description: "I gave a talk at tonight’s ReactJS Denver meetup about Preact."
date: 2017-04-19 09:00:00
categories: js ui
---

I gave a talk at tonight’s [ReactJS Denver](https://www.meetup.com/ReactJS-Denver/) meetup about [Preact](https://preactjs.com).

- Part 1 describes Preact, why you might want to use it, and the tradeoffs you have to make by not using full React.
- Part 2 walks through what Preact is doing internally to render and diff a simple application. To many people, the virtual dom and component model seem like deep mysteries that mere mortals shouldn’t try to understand. As I hopefully demonstrated, this isn’t true. It’s a reasonably simple algorithm with a few fiddly little details. While React is implemented somewhat differently, knowing Preact’s internals is still a good first mental model for approaching it.

The video doesn’t pick up details on the slides, so you may want to [view them directly](https://docs.google.com/presentation/d/1L9bTrSMHGbe7doYi-4SlJt7DCOFT4NrqRWfhhCoDH3k/edit?usp=sharing). If all you want is to see the Preact algorithm diagram, a high-res version of the final state is below the video.

<figure>
  <iframe src="https://www.youtube-nocookie.com/embed/CAg3eJ_pXgc?start=2206" title="Preact in pictures" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
  <figcaption>“Preact in pictures” talk video</figcaption>
</figure>

### The finished diagram

<figure>
  <img src="/img/preact-in-pictures/preact-in-pictures-7dccd42b.png" alt="">
  <figcaption>Diagram of the Preact algorithm</figcaption>
</figure>

---

<small>*Originally published on [Medium](https://asolove.medium.com/preact-in-pictures-2007ebbae54c).*</small>
