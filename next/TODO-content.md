# Content TODOs

## Posts that need a real `description` / standfirst

10 of the 23 migrated posts have no `description:` field in their frontmatter. They currently render with no standfirst on the post page and no `<meta name="description">` in the head — bad for SEO, bad for RSS preview, and the design's titleblock looks unbalanced without the italic subhead.

When we add an auto-generated fallback, these will get a truncated first sentence with an ellipsis — fine as a stopgap, but worth replacing with a real one-sentence subhead per post.

A good description is 1 sentence, ~120–160 characters, answers "what is this post about" in the author's voice. Examples from posts that already have one:

- *Preact in pictures*: "I gave a talk at tonight's ReactJS Denver meetup about Preact."
- *Synchronizable abstractions for understandable concurrency*: "Or: what is Concurrent ML all about?"
- *Only 20 JavaScript runtimes left*: "Claim yours now before we run out!"
- *Epic handshake: reorg half a seat to the left*: "How to avoid handoffs by defining the right roles"

### The list

- [x] `_posts/2012-09-19-deferred-method-combinator.markdown` — Deferred method combinator
- [x] `_posts/2012-09-27-stateful-views.markdown` — Stateful views
- [x] `_posts/2013-05-17-inspired-by-sketchpad.markdown` — Being inspired by Sketchpad
- [x] `_posts/2013-06-08-speak-at-jsconf.markdown` — You should speak at JSConf
- [x] `_posts/2013-10-15-constraint-programming-in-the-browser.markdown` — Constraint programming in the browser
- [x] `_posts/2014-01-06-om-experience-report.markdown` — Om experience report
- [x] `_posts/2014-05-08-react-js-and-om.markdown` — React.js & Om talk
- [x] `_posts/2016-04-13-modeling-with-adts.markdown` — Modeling business problems with ADTs in Flow/js
- [x] `_posts/2016-04-15-flow-exhaustiveness.markdown` — Exhaustiveness checking in Flow
- [x] `_posts/2017-03-04-streaming-cache-mismatch.markdown` — Mismatched assets with streaming service workers

To edit: open the file, add a `description: "..."` line in the frontmatter (between `title:` and `date:`), commit. Cross off the box here.
