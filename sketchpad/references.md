---
title: Understanding Sketchpad—References
layout: sketchpad
permalink: /sketchpad/references/
---

# References

## Primary resources

- ✅ [Sketchpad thesis](https://dspace.mit.edu/handle/1721.1/14979)
  - [Newer, nicely-typeset version](https://www.cl.cam.ac.uk/techreports/UCAM-CL-TR-574.pdf)
- ✅ [[Sutherland Turing Interview]]
- 👀 [Interviews with Sutherland](https://computerhistory.org/blog/the-remarkable-ivan-sutherland/) at Computer History Museum
- ✅ [Sutherland interview](https://www.youtube.com/watch?v=HnvckW1FMHc) for HLF
- [Long biography from ACM](https://amturing.acm.org/award_winners/sutherland_3467412.cfm)
- [Video of Sketchpad in use](https://www.youtube.com/watch?v=T7dC98PNxyE&list=PLKTTWvMgeg0ZJTk-3DY_pwvoih9_gsAw4&index=8): this is the video that Kay's voiceovers are based on, but more complete and higher resolution.
- [Sketchpad III](https://dspace.mit.edu/handle/1721.1/11559) a thesis adding 3D to Sketchpad, from around the same time.
  May have interesting material on someone else learning to use the system and expand its codebase. - [Video of Sketchpad III](https://www.youtube.com/watch?v=t3ZsiBMnGSg&list=PLKTTWvMgeg0ZJTk-3DY_pwvoih9_gsAw4) showing a single 3d object projected in multiple ways
- [Photographs from Lincoln Labs archive](https://tx-2.github.io/photographs) showing TX-2 and Sketchpad in use. These are much higher-resolution images than the ones you normally see, and some are in color.
- [On the design of display processors](http://cva.stanford.edu/classes/cs99s/papers/myer-sutherland-design-of-display-processors.pdf). T. H. Myer and I. E. Sutherland. 1968. Commun. ACM 11, 6 (June 1968), 410–414.
  The "Wheel of Incarnation" article, which describes the process by which the simple controllers for IO devices become more complicated until they eventually take on all the behavior of a generic processor, including jumps, subroutines, etc. Today, we would say "everything is a computer", but at the time the interesting discovery is that "every part of a computer will eventually be its own computer". In modern terms, we might point out the similarity that systems intended just for graphics display (like TeX, PostScript, and 3D rendering engines) inevitably have entire programming languages inside them, or that the GPU hardware originally built for display calculation is now used for cryptocurrency and AI.
- Sutherland, I. E., [“Computer Graphics; Ten Unsolved Problems"](http://bitsavers.informatik.uni-stuttgart.de/magazines/Datamation/196605.pdf), Datamation, Vol. 12, No. 5 (May, 1966), pp. 22-27. Sutherland discussed several long-solved problems, such as needing faster-refreshing displays, better raster graphics support, and ray-tracing for 3D rendering. He also describes the goal of using a computer to simulate complex systems to understand them better than we can with abstract symbols and equations. In particular, he describes the symbolism he uses to he visually understand circuits, which breaks down when they get too complex. He wonders if a computer display could do the calculations to show his symbolism for him, so that he can use it even for more complex circuits. This is exactly the problem taken up by Bret Victor in [Media for Thinking the Unthinkable](https://worrydream.com/MediaForThinkingTheUnthinkable/)'s Demo 2.
- Sutherland, W. R., On-Line Graphical Specification of Computer Procedures, M.I.T. Lincoln Lab., Tech. Report No. 405, Lexington, Mass. (May, 1966).
- [Graphical communication and control languages]

## Other work by Ivan Sutherland

- [Technology and courage](https://cseweb.ucsd.edu/~wgg/smli_ps-1.pdf)
- [6 legged walker](https://www.youtube.com/watch?v=jrMfU2FtSBk): a 1983 demo of a DARPA-funded walking machine.
- [Some thoughts about concurrency](https://www.youtube.com/watch?v=jR9pAaQlVRc): a lecture at USENIX on how to improve our thinking about concurrent programming.
- [Virtual reality before it had that name](https://www.youtube.com/watch?v=Y2AIDHjylMI): a retrospective on The Sword of Damocles, a very early prototype of head-mounted virtual reality display.

## Second-hand demos or voiceovers

- [Historical retrospective with 1963 demo clips](https://www.youtube.com/watch?v=6orsmFndx_o)
  Shows interactive usage and pretty clearly demonstrates the "twinkle" display mode.

## Impact of Sketchpad

### Architecture

- Konstan, ["Drawing on Sketchpad: Reflections on Computer Science and HCI"](https://direct.mit.edu/books/edited-volume/3814/chapter-abstract/125135/Drawing-on-SketchPad-Reflections-on-Computer?redirectedFrom=fulltext)
  - Appears in ["HCI Remixed"](https://search.libraries.emory.edu/catalog/990007904240302486)
  - This is a retrospective on Sketchpad's impact on the field of HCI and the author's own career. It briefly describes the ways in which Sketchpad anticipated later systems and passes on a story of a graduate student being puzzled by the paper, wondering "isn't this how computers just are?". The paper's main argument is "HCI belongs as part of computer science because the needs of innovative interfaces drive forward the science of computing."
- Risenfeld, ["Static Image Generation"](https://www.spiedigitallibrary.org/conference-proceedings-of-spie/0059/0000/Static-Image-Generation/10.1117/12.954347.short), (1975) early paper describing impact of Sketchpad
- van Dam, ["The Shape of Things to Come"](https://dl.acm.org/doi/10.1145/279389.279446) (1998): brief mention of early Sketchpad impact
- ["The Sketchpad Window"](https://vtechworks.lib.vt.edu/server/api/core/bitstreams/ced55f4b-e70e-44e5-bdb4-2485ba01401e/content): a Ph.D. dissertation seemingly mostly about the impact of Sketchpad on architectural drafting
- [Daniel Cardoso Llach](http://dcardo.com/) (various works and collaborations)
  - [The Architecture Machine](https://www.amazon.com/Architecture-Machine-Andres-Fankh%C3%A4nel-Teresa/dp/3035621543/ref=sr_1_1?crid=2E00RB39EZDTO&dib=eyJ2IjoiMSJ9.jZ7lb-Fug6BM3jIH08fvUIxmV1aMD1VmgWHiChm21JsTLzEdQAGYyJB1zEheWiA_zY-p9iacu48E7lgLVM1YndK23l9LUrRSgqo2AS6Qr4yrTUhItuyjWBCYqkjBLxjlS25gcB2zB725M9VrysLlkWAXi1SPdcC0k_cXpkT4TrZkpWOn_Z5oYdYVt6Y2XIU4Bfa1SBDMveC3BWZwlvC9dVys5NRD-xfXDZTRDLkMv7U.FI72ZQ_jAfg8DD7koBxXCs0arFk3PZGmdKM98HRdPIE&dib_tag=se&keywords=the+architecture+machine+role&qid=1715000482&s=books&sprefix=the+architecture+machine+rol%2Cstripbooks%2C97&sr=1-1) accompanies a museum exhibit that included recreations of Sketchpad. The Sketchpad chapter is a short overview of Sketchpad along with photographs of a physical recreation of Sketchpad made for a museum exhibition. It has a realistic physical terminal with buttons, an Android tablet emulating the original CRT screen, and a physical lightpen for interacting with it.
  - [Recreation of Sketchpad](http://dcardo.com/projects/archaeology_of_cad/index.html) has pictures and video of a physically accurate recreation, including a light pen, buttons, and a physical console matching the original.
  - [Algorithmic Tectonics: How Cold War Era Research Shaped Our Imagination of Design](https://onlinelibrary.wiley.com/doi/abs/10.1002/ad.1546): seems to be a cultural study of how DoD funding for e.g. Sketchpad led to changes in building design and production
- [Curiosity and Possibility: The Ivan Sutherland Story](https://www.youtube.com/watch?v=vPsFPmgT0YM)
  A retrospective video made by the National Inventors' Hall of Fame

### Programming languages and styles

- [Graphical Communication and Control Languages](https://archive.org/details/TN_Graphical_Communication_and_Control_Languages_20171030_0025/page/n3/mode/2up), L.B. Roberts, Information System Sciences: Proc Second Congress, 1965 describes a new programming language built after the influence of Sketchpad, CORAL (Class Oriented Ring Association Language)
- [Associated processing of line drawings](https://dl.acm.org/doi/pdf/10.1145/1478786.1478864) describes Sketchpad and subseequent attempts to represent graphical data in memory for efficient processing and display. Discusses CORAL and GRAPHIC-2
- [Machine perception of three-dimensional solids](https://dspace.mit.edu/handle/1721.1/11589) was Lawrence Roberts' Ph.D. dissertation, submitted the same year as Sutherland's. It is one of the first papers in computer vision, tackling the problem of taking a 2D line drawing and having the computer reconstruct the 3D solids that are represented. The ring structure used is a lightly-modified version of the one used in Sketchpad. Sutherland is credited several times for providing inspiration and debugging help. The object detection algorithm also uses a generic error minimization approach that shares a lot in common with Sketchpad's constraint solver.

- "Programming Languages: History and Fundamentals", Sammet, Jean E., P-H 1969. An early catalog of programming languages. CORAL is mentioned on p.462, in the same chapter ("String and List Programming Languages") as Lisp and SNOBOL.

### User interfaces

- [paint: a history](https://kristenroos.ca/timeline) traces the timeline of UIs for drawing via computers, noting Sketchpad and later programs.
- Citation for Computer Lib / Dream machines, summary of Sketchpad on DM23.

  - Also cites "wheel of reincarnation" paper, above
  - "For some reason, however, the most important aspect of such systems
    has been neglected, We do not make important decisions, we should not
    make delicate decisions, serially and irreversibly. Rather, the power of
    the computer display (and its computing and filing support) must be so
    crafted that we may develop alternatives, spin out their complications
    and interrelationships, and visualize these upon a screen." (DM 52)

  - "Since hundreds of such systems are now
    being built, many of them all wrong, we must
    teach designers (end certain others) the basics
    of computers , and give them some good examples
    lo emulate (such as Sutherland's Sketchpad,
    Bilzer's PLATO, and, I hope, some of my own
    designs)." (DM 58)

- ["PYGMALION: A Creative Programming Environment](https://worrydream.com/refs/Smith_DC_1975_-_Pygmalion.pdf) cites Sketchpad as an influence (52-55)
- TODO: re-watch NLS demo for mentions/related material
- TODO: read "Designing the Star user interface" https://guidebookgallery.org/articles/designingthestaruserinterface/
  - In general, thank GUIdebookgallery site for their help
- "Your wish is my command" and "Watch what I do"
- Bill Buxton's [Resource Page on Early HCI Research by the Lincoln Lab TX-2 Group](https://billbuxton.com/Lincoln.html)
  Buxton is himself a well-known HCI practitioner and studied under Ron Baecker, who overlapped with Sutherland at the MIT Lincoln Lab during the 60s. This page includes many links on the TX-0 and TX-2 computers and the HCI work done at Lincoln Lab during this time. Sadly, many of the archive links are now broken.
  - TODO: try broken links in Wayback machine. Archive everything I link to so it can be found even if links break.
  - TODO: Read 2005 SIGCHI conference session
    - https://www.billbuxton.com/LincolnLab.pdf
  - TODO: Review 1989 SIGGRAPH panel (https://dl.acm.org/doi/10.1145/77276.77280)
  - TODO read and add https://guidebookgallery.org/articles/thefatherofcomputergraphics (1990 article in BYTE). Mention of "Space War" on the TX-2: find more about that
  - TX-2 program/docs examples: http://www.bitsavers.org/pdf/mit/tx-2/
- [sutherland](https://github.com/alexwarth/sutherland) is a recreation of the bridge simulation. It has a very interesting constraint solver implementation and several of the bridge images pre-programmed. From what I can tell, it doesn't have arbitrary user input to construct your own pictures or constraints.
- Overveld
  - ["30 Years after Sketchpad: relaxation of geometric constraints revisited"](https://www.researchgate.net/publication/254868876_30_Years_after_Sketchpad_relaxation_of_geometric_constraints_revisited_II)
  - [Sketchpad14](https://github.com/cdglabs/sketchpad14)
  - [Back to a Half-Century Later: "From Sketchpad61 to Sketchpad14"](https://cdglabs.github.io/sketchpad14/blog/) is a series of essays on using constraints to build explorable environments, illustrated with runnable Sketchpad14 examples.
- ThingLab
  - ["Thinglab"](https://constraints.cs.washington.edu/ui/thinglab-tr.pdf) was Alan Borning's Ph.D. thesis that brought constraint-based programming to Smalltalk. Alan Kay described this as, though 15 years later, "the first serious attempt to go beyond Ivan Sutherland's Sketchpad".
  - ["The Programming Language Aspects of ThingLab, a Constraint-Oriented Simulation Laboratory"](https://worrydream.com/refs/Borning_1981_-_The_Programming_Language_Aspects_of_ThingLab.pdf)
  - Also see [a recreation of Thinglab](https://cdglabs.github.io/thinglab/) runnable in the browser and [its source code](https://github.com/cdglabs/thinglab).
- ["Special Issue on Constraints"](https://www.semanticscholar.org/paper/Introduction-to-the-Special-Issue-Cruz-Marriott/81b02fbb7accd71245cdbdbb8f78188c9b70e825)
- ["The Early History of Smalltalk"](https://worrydream.com/EarlyHistoryOfSmalltalk/) a retrospective by Alan Kay that mentions Sketchpad as part of the inspiration for OOP, as well as contributing important ideas about windowing and constraints.
- ["Doing with images makes symbols"](https://archive.org/details/AlanKeyD1987?start=249.5) is a talk by Alan Kay
- ["The future of programming"](https://worrydream.com/dbx/) is a talk by Bret Victor that discusses Sketchpad as an example of direct manipulation and constraints to accomplish goals without direct writing of code.
  - ["Additional notes on 'Drawing Dynamic Visualizations'"](https://worrydream.com/DrawingDynamicVisualizationsTalkAddendum/)
  - ["Magic Ink"](https://worrydream.com/MagicInk/)
  - ["Inventing on Principle"](https://vimeo.com/906418692)
    - There is an interesting blog post response and a [comment section](https://computinged.wordpress.com/2012/02/21/bret-victors-inventing-on-principle-and-the-trade-off-between-usability-and-learning/#div-comment-9525) in which Alan Kay and Bret Victor show up and discuss the ideas, with a passing mention of Sketchpad.
- [Apparatus](https://github.com/cdglabs/apparatus) is a hybrid graphics/programming environment that has ideas similar to Bret Victor's talks on dynamic visualizations.
- [Hacker News comment by Alan Kay](https://news.ycombinator.com/item?id=10967103) describing the impact of Sketchpad on Smalltalk and other Xerox PARC projects.

## To explore for citations

- Mentions in MIT propagator network dissertation?
-
