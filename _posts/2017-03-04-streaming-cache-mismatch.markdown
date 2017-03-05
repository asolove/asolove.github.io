---
layout: post
title:  "Mismatched assets with streaming service workers"
date:   2017-03-04 21:43:39
categories: js service-worker stream
---

Recently I’ve been researching how to use service workers to speed up traditional, multi-page websites rather than SPAs. [Some](https://twitter.com/slightlylate/status/831225152515944449) [Googlers](https://jakearchibald.com/2016/streams-ftw/) have been promoting the use of streaming responses, with a header chunk cached client-side so the page can start constructing the CSSOM and do an initial render while it’s still waiting on page-specific content from the server. I’ll get into the why and how of that in a later post after I figure a few more things out.

Right now, I want to ask those in the know about a problem I’ve run into and see if they have a solution.

What’s the problem? Pages rendering without styles because cacheing causes mismatched CSS and markup.

Which seems silly. Surely this is a solved problem?

On a normal website, we avoid this problem by adding some fingerprint to the end of the asset URLs to make sure that the page’s content gets the versions of styles and scripts that the content expects.

With a single-page app, each chunk of css is cached at the same time as the html (or javascript views) that it styles, so they’re always in sync with each other.

But the same isn’t true when the header chunk is cached locally but page content is streamed from the server. The cached header markup may include an out-of-date CSS url that is then applied to content from the server that expects newer styles. 

Here’s the specific flow:

- Visitor comes to your site, installs service worker with cached header and css.
- You rename all your css selectors and change markup to match.
- Visitor returns and views a new page, which has the old header and styles but new markup in the body content.

The result is one very ugly page. (I’m assuming your page looks worse without its styles applied, which I guess is not a guarantee on today’s web.) The same can easily happen with scripts, but with styles it’s much simpler to see.

I don’t refactor my css fully that often, so it's usually fine for one page view to show old styles. But in the fragile world of container microservice edge-cached web things, I already have enough unintended consequences to think through each launch. I don't want to add manual CSS cache invalidation to the list. I’d like an automated solution that works correctly all the time.

Let me restate the problem: if our service worker is streaming the body of a page from the server, it should check if the styles in the local cache are up-to-date with the server. If not, it should abort the streaming response, load the full page from the server, and let an updated service worker take over.

One implementation would include some identifier of the CSS (or service worker) version in the site’s response headers. The streaming logic should check this header and, if it doesn’t match, unregister the service worker and write inline javascript to refresh the page. With this solution, the page will always load correctly. But it will take one full round-trip to invalidate the cache followed by one full page load with a cold cache. That’s not great.

In the most common case, we will soon be able to do better. If the first request that needs to hit the server is also the first page view in the session, browsers will soon do a [navigation preload](https://developers.google.com/web/updates/2017/02/navigation-preload), requesting the full page immediately, while the service worker is still booting up and before it has a chance to handle the request from the cache. Normally we would throw out that preload request if the cache can answer faster, but not in this case. To avoid a css/markup mismatch, the service worker should instruct the browser to use the preload full page request and then unregister itself. The full page request will then have matching styles and markup and can register a new version of the service worker immediately.

(Above, I'm simplifying by only considering the case where the network is available and reasonably fast. Otherwise, the service worker should still use the cached header and whatever “not available” treatment it normally shows if streaming a page body times out.)

So: service worker and streams braintrust, is there a solution I'm missing? Or is this the best we can do for now?
