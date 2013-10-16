---
layout: post
title:  "Constraint programming in the browser"
date:   2013-10-15 08:00:00
categories: js
---

<p class="abstract">To build more powerful user interfaces, we need more powerful models.
Constraint programming provides one useful tool: removing the distinction between input
and output.</p>

<hr>

My talk from JSConf 2013 on constraint programming in the browser is now online:

<iframe width="480" height="360" src="//www.youtube-nocookie.com/embed/72sWgwaAoyk?rel=0" frameborder="0" allowfullscreen="allowfullscreen" style="margin-bottom:30px">&nbsp;</iframe>



## Resources

- To learn more about the Cassowary algorithm, read [The Cassowary linear arithmetic constraint solving algorithm](http://www.cs.washington.edu/research/constraints/solvers/cassowary-tochi.pdf).

- To see the power of constraints in UI applications, read Greg Badros' Ph.D. thesis, [Extending Interactive Graphical Applications with Cassowary](http://www.badros.com/greg/papers/gjbadros-dissertation.pdf) which describes the benefits of adding constraints to a window manager, a CSS layout engine, and an SVG engine. Greg also deserves credit I failed to give in the talk as the original author of the JavaScript Cassowary implementation.

- To learn about core.logic, watch [David Nolen's talk from StrangeLoop 2012](http://www.youtube.com/watch?v=A7de6pC-tnU).


## Code

- [The slides](https://github.com/asolove/jsconf-2013-slides)

- [The budget demo](https://github.com/asolove/scrubbing-budget)

- [The calculator demo](https://github.com/asolove/scrubbing-linear-calculator)
