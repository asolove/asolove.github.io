---
title: Understanding Sketchpad
layout: sketchpad
permalink: /sketchpad/
---

# &nbsp;

<hr>

# Understanding<br>Sketchpad:<br>why it matters

## The context

In 1962, you interact with computers by meticulously encoding your program and data on punchcards. You turn them in to your local computer operator, who schedules them for some time in the day. The results of the program are encoded back onto punch cards, which you can pick up the next day.

<aside>
<img alt="1962-08-12, Ivan Sutherland using Sketchpad graphics program at the TX-2 Computer" src="/img/sketchpad/sutherland-using-sketchpad.jpg" />
</aside>

Unless you're Ivan Sutherland.

If you're Ivan Sutherland, you sit in front of a computer monitor, draw diagrams with a pointer, issue commands with buttons, and see the results in real time. When the result isn't exactly what he wants, he can drag things around on the monitor. Or he can add new instructions for the computer by pointing.

Ivan Sutherland in 1963 is living in a future that will continue to look futuristic 20, 40, and 60 years later.

So what is he doing?

## The program

The program he's built is called Sketchpad. It introduces, or plants the seeds for, many of the core ideas of contemporary computing: graphical user interfaces, direct manipulation, object-oriented programming, windows and pointers. And it inspires an entire generation to think in a new way about what computers are for:

<blockquote>What [Sketchpad] could do was quite remarkable, and completely foreign to any use of a computer I had ever encountered.<br><cite>&mdash; Alan Kay, <a href="https://worrydream.com/EarlyHistoryOfSmalltalk/">The Early History of Smalltalk</a></cite></blockquote>

<br>
<hr>
<br>

## Using Sketchpad

The user needs to make a large-scale drawing of a tiling pattern of regular hexagons. The goal is 900 hexagons filling a large 30" x 30" sheet of paper. The drafting department has estimated this would take them two days of work in manual calculation and measurement.

Let's see how Sutherland solved this problem using Sketchpad.

First, he presses a button to engage the circle tool and draws a circle on the screen. (An aside on how much is happening here: drawing, direct manipulation, directly making the thing you want rather than making a memory address and language.)

Next, he switches to the line tool and draws a rough hexagon, where each point lies on the circle. This tells Sketchpad that, even as the points move, they need to lie on the circle.

Next, he selects the equidistant constraint and applies it to each of the lines. Sketchpad moves the points so that they remain on the circle but also become equidistant from each other.

TODO: find a use-case that illustrates:

- direct manipulation
- constraints
- picture - instance
- definition copying
