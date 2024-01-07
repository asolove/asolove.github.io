---
layout: post
title: "Being inspired by Sketchpad"
date: 2013-05-17 22:01:39
categories: js ui
---

<p class="abstract">Ivan Sutherland's Sketchpad was the first graphical user interface. Learning about Sketchpad over the past few months has inpired me to go deeper into the history of user interface programming and to expect more from the interfaces that I build.</p>

## Demo

If you don't read any farther, at least watch Alan Kay discussing the historical importance of Sketchpad and showing video of the program in use:

<iframe width="640" height="480" src="http://www.youtube.com/embed/495nCzxM9PI" frameborder="0" allowfullscreen="allowfullscreen" style="margin-bottom:30px;">&nbsp;</iframe>

## What makes Sketchpad so important?

While building the program in 1963 as part of his Ph.D. thesis, Sutherland also stumbled upon several enduring ideas in UI programming:

- **Method dispatch**: Although Sketchpad was written in assembly, and the idea of objects was only just about to be formalized, Sutherland implemented his own form of typing and method dispatch. For each type of object, the program stored a block of operations specific to that type. Other parts of the program could just ask for a specific object to run a named operation, and the correct one would be chosen.

- **Generality**: Sutherland build three versions of the system. Each rewrite involved taking some part of the interface and code that was currently a separate case, and instead making it an instance of a generic part. Method dispatch helped make this possible. But the process also involved intensely clarifying the fundamental ideas behind the program to try to achieve a closed system, in which every available operation applied to as many different objects as possible.

- **Prototypical inheritance**: Sketchpad allowed users to take an entire drawing and clone it into another. The master drawing could be updated and these changes would propagate throughout all clones. The clones were not stupid, either: they could include internal constraints or join-points that let them interact with the drawings they were used within.

Sutherland also faced challenges we no longer have. He had to modify the computer's operating system to support constantly getting input from the lightgun and constantly outputting to the screen. He had to write drivers for the input and output devices. And he made some algorithmic advances to the way that basic shapes were rendered to the screen.

## Why is Sketchpad still a source of inspiration?

While some of the ideas from Sketchpad have become common knowledge, others have yet to make it into the mainstream:

- **Constraint programming**: If you use a drawing program today, it either supports direct editing like Photoshop, or it supports mathematical correctness, as in a graphics library for a programming language. Sketchpad is so powerful because the user can provide direct input, and then clean it up with mathematical precision later. Or, the user can ask for certain mathematical relationships to be maintained, and then interact with the resulting construction. By removing the distinction between input and output, constraint programming allows more powerful interaction between person and computer.

- **Prototypical inheritance exposed to the user**: Once programs reach a certain level of power, it becomes necessary to share artifacts from one run of the program with another. Think of Microsoft Word templates, shared layers in Adobe products, etc. But few of them do it as cleanly as Sketchpad. And many other programs could benefit from exposing the power of reusable prototypical instances.

And then there's the bigger perspective. It's pretty amazing to think that all of this was done by one person, in the course of one year, while building the very first program of its kind. What have you done in the last year?

## Learn more

- [Read Sutherland's thesis](http://www.cl.cam.ac.uk/techreports/UCAM-CL-TR-574.pdf), an eloquent and easy-to-follow description of the program's history, its final state, and its use for various applications. Because he was inventing fundemantally new ideas, a lot of the language of the paper takes a while to correlate with contemporary terms. But the ideas themselves are very clearly explained.

- [Help recreate it!](https://github.com/asolove/Sketchpad) I recently started trying to recreate Sketchpad as a browser application in ClojureScript. The codebase is very new and there is a lot to do, from fixing up some css, to browser testing, to actually getting around to writing a constraint solver and a prototypical instance generator. Pull requests are welcome.
