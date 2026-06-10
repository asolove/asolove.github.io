---
layout: post
title: "Learning about learning"
description: "Notes on study skills, meta-cognition, and how organizations learn — distilled from a vacation spent reading about learning"
date: 2018-01-23 09:00:00
categories: learning
tags: craft
---

Thanks to an extended holiday vacation and some family illnesses, I was lucky enough to spend two weeks reading about how people and teams learn. It was really interesting.

### **Why read about learning?**

A few months ago, I started working at Stripe. It has felt like Neo getting plugged into the training modules. Except instead of kung fu, I know about complex online business models, brand-new payment methods, and detailed financial regulations. (It might not sound like it, but this has been really fun!)

Stripe has lots of teams working on lots of things. The organization has to understand and adapt to everything going on in the worlds of finance and tech. So teams generate enormous quantities of knowledge. And the projects I work on have enough scope that I sometimes need to understand large parts of that outside knowledge to do my job well. (If this sounds fun, I’m obligated to mention [we’re hiring](https://stripe.com/jobs) and you should contact me if you have any questions.)

So I need to read, systematize and retain more information every day. And my code and prose need to convey that context to others. This has been a big but fun challenge.

That’s why I started reading about how individuals and whole organizations can learn. There are a lot of great books about this, and I’ve only read a tiny number of them. But **I hope these summaries encourage you to learn more about learning or to be more thoughtful about your own work.**

### **Study skills and meta-cognition**

My first goal was to understand how I could learn and retain more by myself. I used the very scientific method of picking the first highly-rated book on Amazon, which was [*Teach Students How to Learn*](https://www.amazon.com/Teach-Students-How-Learn-Metacognition/dp/162036316X/). This book is aimed at professors who want to help their students adjust to the self-directed learning of a college environment. But if you ignore the faculty-specific bits, it’s also a great guide to being a better learner yourself.

It covers a lot of material about study skills, meta-cognition, different failure modes for teaching and learning, and how to create a learning-friendly environment. A lot of the ideas were already in my brain somewhere, but I was mostly ignoring them in my day-to-day work. So a systematic reintroduction to them was really helpful. Here are some specific things I took away:

- Partway through this book is a section on **how to retain what you read**. I paused there to ask myself how much of the previous material I remembered, and it wasn’t a lot. That section described a strategy of pre-reading to build an outline for the material, then reading to fill in that structure, and taking notes for a specific purpose. So I started the book over again following that advice. I now have a great set of notes, but I also remember a lot of the material and chose specific ways to apply it. Now when I need to read documents, I apply that same strategy and am able to recall much more of it.
- A section about meta-cognition described various ways **you can be aware of yourself as learning** and consciously choosing strategies to do it. It also describes patterns of mental self-talk that help or hinder this awareness. I identified pretty strongly with several of these. I like to tell myself that I read quickly so I can just breeze through things. Or there are specific topics that I’ve never really understood and have developed complex excuses about, so I don’t even expect to understand. (Like graph algorithms, for some reason.) Neither of these thoughts is helpful. The book describes a way to start **noticing and gently changing your self-talk**. I’m still working on this, but I already see some improvements. I’m much more likely to pause before reading something and consciously decide my goal and my desired level of recall so I can pick a reading strategy before I start.
- Another section on the biology and psychology of learning reminded me to **take care of myself** before getting stressed out about work. If I take breaks, get in some stretches, and drink enough water, I can be calmer and more likely to be self-aware about how I’m thinking. I’m learning to recognize the sensation of shutting down and becoming too narrowly focused to really pay attention to the broad context of my work.

After finishing the book, I was pretty excited to apply these strategies in my learning and teaching. But I was also a bit perplexed: all this advice seems to be about extra things students should do to turn lectures and textbooks into real learning. Couldn’t we cut out the middle step and find a way to expose information in a way that naturally invites interactive learning?

### Learning with computers

So I picked up [*Mindstorms: Children, Computers, And Powerful Ideas*](https://www.amazon.com/Mindstorms-Children-Computers-Powerful-Ideas/dp/0465046746) and was fascinated with its main themes. In part, the book describes the Logo children’s programming environment and how it can be used to teach math. But more importantly, it argues for a different method of teaching, where children figure things out for themselves by interacting with computers.

How do computers lead to a different way of learning?

- Children are often unaware of the strategies or patterns of thought they are using. They get angry when they arrive at the wrong answer, and have a hard time examining the thought process they used to see where they went wrong. (Which, I mean, me too.) Programming is specifically about putting these strategies into an external representation. And when the program is wrong, you don’t have to self-identify with its wrongness. You can look at the program “from the outside” and debug it until it’s right. Which is great! You learn to expect a first try to be a little wrong. You learn to examine *why* it is wrong. And you learn that this meta-cognition, rather than answering right or wrong on the first try, is what learning really feels like. Applying this same process to your thinking, not just your programs, is a good way to improve at learning.
- Computers provide an interactive medium to model any kind of system. For most topics, you could take all the material in a textbook and rearrange it into an interactive version that allows exploration in different orders and encourages students to consciously build a mental structure to hold the information. This change, from a set curriculum to a self-directed exploration, forces real learning habits onto the student. (And turns excuses like “I just don’t get X” into actions like “I’ll try playing with related idea Y first”.)

I really enjoyed *Mindstorms* as a critique of learning methods in general. It’s hard to convey in summary: there are a lot of interesting concrete ideas in there.

**The main idea I took from *Mindstorms* is a sharp discomfort when using static words to convey the interactive behavior of complex systems**. But I don’t yet know what to do about this. How would I go about building an interactive model in anywhere near as little time as I would need to write prose to describe it? What kind of tooling would make this easier? I’m not sure.

### What actually happens when we learn?

Several footnotes in *Mindstorms* referenced Bruner’s [*Toward a Theory of Instruction*](https://www.amazon.com/Toward-Theory-Instruction-Belknap-Press/dp/0674897013)*,* so I continued my reading there. This book is a collection of essays that span from details of cognitive psychology all the way to philosophy and the ultimate goals of human life. The most interesting parts for me were about the question: what actually happens when we learn? What is the actual function of a teacher, a text, an image, a study session? What is the actual effect in our mind’s ability to think about the subject?

- One essays presents a theory that **knowledge can be represented through action, through visual symbol, and then through abstractions like language**. And that our knowledge of the same topic progresses through these over time. When looking at a spec, we might first role-play the interactions to understand the “purpose” or “motive” of different parts, then later summarize our understanding as a diagram, and only later learn to think in terms of the actual data and operations in code.
- Another section drew this idea out further to argue that learning is a sequence of cognitive changes where each step may require a new representation of the topic. This has been a good reminder that **there can never be one canonical explanation of any knowledge that different communities of people need to understand**. The right representation of the information is relative to the knowledge and goal of the viewers.

Further on, I was really struck by this idea:

> “It took the efforts of many highly talented mathematicians to discern the underlying structure of the mathematics that was to be taught”

This is a comforting thought when a subject is hard to learn! It’s not clear to me, but it also wasn’t clear to many of the same people who made progress on particular bits of this material.

I arrived at an image of a math course as a large pile of unassembled legos. Over time, people shape them into local, overlapping structures which only coalesce at the last moment into a surprising finished product. It shouldn’t be surprising if students presented with just the raw materials and then just the finished structure have trouble seeing how they could possibly be related. They need in part to try assembling the bits themselves, or at least see some of the early results, for the picture to become clear.

It also helped me accept that for subjects I’ve had trouble with in the past (like graph algorithms), I should search out different partial explanations for the material. (Which I’m doing! About which, more in a future post.)

### How to teach it

I can’t write a post about conscious problem-solving and different ways of learning without mentioning George Pólya. After reading so much about self-teaching and meta-cognition, I wanted some concrete suggestions that were specific to the domains of programming and math. So I picked up a copy of his [How to Solve It](https://www.amazon.com/How-Solve-Mathematical-Princeton-Science/dp/069111966X) and am slowly making my way through the strategies. **Stuck on a problem? Just flip to a method at random and try what it says**. (This has worked for me more than once.)

I also found a great video of Pólya demonstrating his student-directed teaching technique. He poses a problem and then gently steers a room full of students to use problem-solving strategies. The video lasts an hour, but I found it worth the time to see his approach in action.

<figure>
  <iframe src="https://www.youtube-nocookie.com/embed/h0gbw-Ur_do" title="Learning about learning" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
</figure>

For extra fun, try pausing part-way through and proving the solution yourself. Guess if the students will follow the same path. I wrote a proof with a completely different path from the one in the video. Interestingly, I noticed that Polya side-steps or ignores some student questions and answers that would lead towards the way I solved the problem. Maybe my proof has a flaw in it. But this made me wonder if he really wants to solve the problem in one specific way, and whether his method might not work for some students.

It was painful for me to watch him ignore the line of inquiry that clicked for me. (Even if it’s faulty, I’d like to know why, and his method hasn’t showed me.) The memory of that pain is a regular reminder to me: don’t waste time on the one perfect explanation. Explain things several ways. And always let your audience figure it out themselves or ask questions that might lead along an unexpected but interesting path.

I hope these book suggestions and summaries lead to fruitful changes to the way you teach and learn! They certainly have for me.

In a future post, I’ll summarize a few other books I read which focus not on individuals but on how whole organizations learn and think together. This material was even more surprising to me, and has important consequences for how companies and whole disciplines work together. Look forward to that soon.

---

<small>*Originally published on [Medium](https://asolove.medium.com/learning-about-learning-98d1a22b8be0).*</small>
