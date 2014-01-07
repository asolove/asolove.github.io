---
layout: post
title:  "Om Experience Report"
date:   2014-01-06 08:00:00
categories: js clojure
---

A few weeks ago David Nolen [announced Om](http://swannodette.github.io/2013/12/17/the-future-of-javascript-mvcs/): a thin ClojureScript wrapper over [Facebook's React](http://facebook.github.io/react/), which provides a functional API for building interactive browser apps. I spent a few hours scattered over my Christmas vacation building [a sample app](https://github.com/asolove/carto-crayon) in Om and have really enjoyed it.

**What I learned: Om is a practical way to build web user interfaces in a functional style, and a lot of fun.**

Below are a few impressions and tips. I'm not an experienced Clojurian nor do I have any private information about the design and future of Om, so I suspect David will shake his head at various parts of this post and my code. And that's fine.

<hr/>

<br/>

## What I built 

[CartoCrayon](https://github.com/asolove/carto-crayon) is an early experiment in styling geojson data.

<img alt="CartoCrayon screenshot" src="https://raw.github.com/asolove/carto-crayon/master/resources/public/screenshot.png" style="width:100%">

Right now it only has one baked-in dataset and only works with a specific map, but you can select geographic features and style them manually or based on data. [You can try it out](http://adamsolove.com/carto-crayon/) if you don't mind the poor user experience.

I figured this would be an interesting challenge for Om because it involves some traditional browser UI work but also requires cooperating with a stateful mapping library that can't just be re-rendered each time. 

<hr/>

<br/>

## Working in ClojureScript

I've been excited about ClojureScript ever since I heard the announcement. I've tried to pick it up for real use three or four times over the past two years and always reached a hurdle I wasn't willing to scale. There were problems getting an environment working, incompatible version issues, debugging pains, really slow builds resulting in really large files, and headaches with js interop. The last time I tried, several months ago, everything about the language clicked really well, but the available options for working with the DOM were either not expressive enough for my needs, or just thin wrappers over the stateful DOM methods, which seemed to mar the beauty of the Clojure code.

If you experienced these kinds of problems and gave up on ClojureScript in the past, let me be the first to invite you back for a second try. As a language, a toolset, and a library ecosystem, ClojureScript is ready for prime-time. Starting a project, building it, and getting a repl are really easy. Build times and sizes are way down. Interop is a lot easier. Source-maps make debugging usually painless. The only problem I have is that I still don't understand the advanced compilation options.

And now Om provides an idiomatic, functional DOM abstraction.

<hr/>

<br/>

## How to start


0. Learn ClojureScript. You can pick up enough of it to be dangerous with [ClojureScript: Up and Running](http://shop.oreilly.com/product/0636920025139.do) although you'll eventually want to read a full Clojure book to understand all the details.

1. Understand React. Start with the very good [React Tutorial](http://facebook.github.io/react/docs/tutorial.html). It's also worth skimming the Guides linked on that page. And bookmark the [Component Lifecycle doc](http://facebook.github.io/react/docs/component-specs.html), which you will want to refer to often.

2. Learn to use Om. Start with the [Conceptual overview](https://github.com/swannodette/om/wiki/Conceptual-overview). Then browse the [Om TodoMVC implementation](https://github.com/swannodette/todomvc/tree/gh-pages/labs/architecture-examples/om/src/todomvc) which shows a simple example of rendering state to the DOM and reacting to DOM events with state changes. There are a few tricky bits involving channels, but after two or three reads it is quite comprehensible. Then read the [source of Om core](https://github.com/swannodette/om/blob/master/src/om/core.cljs), skimming the cursor implementations the first time through.

<hr/>

<br/>

## The enemy DOM is down, or: orienting yourself in Om

In my mental model of MV* apps, the models are at the bottom, with views above them. Views have direct references to models, but models only talk to views through callbacks. I tend to picture myself on the view layer, issuing commands to, or receiving notifications from, the models beneath me. 

My mental model of Om is flipped. I'm standing at the top of a cliff with the application's state. The enemy DOM is down. Changes to the application state roll downhill, getting passed through the components that reference them, resulting in an avalanche of changes on the DOM. On the other hand, getting changes from user interactions back into the application state is fighting against gravity and supposed to be a bit harder.

I find Om most useful when I design my data layout following this model: the path from data to DOM should be natural and cheap, even if it means that getting user interactions back into the application state is somewhat harder and more expensive.

<hr/>

<br/>

## Interacting with stateful libraries

My project involved a map with a somewhat expensive DOM setup and big pieces of geographic data that should only get parsed once. Interacting with these stateful items from Om was surprisingly easy.

The map gets initialized only once, when the map component is first attached to the DOM, and then saved into the map's state:

{% highlight clojure %}
(defn map-view [layers]
  (reify
    om/IDidMount
    (did-mount [_ owner _]
      (om/set-state! owner [:leaflet-map] 
        (L.mapbox.map "map")))
    ; …))
{% endhighlight %}

The geographic data gets parsed only once, added to the map, and put into the feature component's state when the component is initialized the first time. Each time the component is updated with new data, we just grab the existing data from the component state and restyle it:


{% highlight clojure %}
(defn map-feature [feature {:keys [map]}]
  (reify
    om/IInitState
    (init-state [_ _]
      (let [feature-layer (L.geoJson (:geometry feature))]
        (.addLayer map feature-layer)
        {:feature-layer feature-layer}))
    om/IDidUpdate
    (did-update [_ owner _ _ _]
      (.setStyle (om/get-state owner [:feature-layer]) 
        (resolve-styles feature)))
    ; …))
{% endhighlight %}

These are examples where we really need to maintain pieces of state and not recalculate them each time. Om handles them quite well, while making functional updates very easy.

<hr/>

<br/>

## Lifecycle methods 

When working with object-oriented, stateful UIs, I often add extra bits of display logic into event handlers besides just changing model data. I thought that I would miss this in Om, since each component would render its current state without knowing exactly what had caused the change. In most cases I have been able to work around this by using React's lifecycle methods.

For example, when selecting a geographic feature on the map, the feature list should scroll to the newly-selected item. Because this happens in response to a specific user interaction, and not to other interactions that might cause the exact same model-level change, I would normally add this behavior into the right view-level event listener. With React/Om, I made this a responsibility of the component that displays each feature's row in the table. In the `did-update` method, I check the row's current and previous state: if it is now selected but wasn't during the last render, then it scrolls the table to make itself visible:

{% highlight clojure %}
(defn feature-row [feature {:keys [cols select]}]
  (reify
    om/IDidUpdate
    (did-update [_ _ prev _ node]
      (let [prev-data (.-__om_value prev)]
        (if (and (:selected feature) 
                 (not (:selected prev-data)))
          (ensure-feature-visible node))))))
{% endhighlight %}

The syntax to get the previous data is a bit ugly and it looks like David is planning to [change it](https://github.com/swannodette/om/issues/24).

<hr/>

<br/>

## Why Om?

I have tried using functionally-oriented UI tools in the past and been frustrated by problems with expressiveness or modularity. The two approaches I have tried, using Rx streams or FRP, are both very expressive at taking data and building interfaces. But as apps grow more complex, these approaches make it quite complicated to change the data in response to user interactions. At the beginning you have nice data flows, but many kinds of minor adjustments require making major changes to those data flows, and they eventually become too hard for me to understand. 

As an example, try reading the code for a [todo list in an FRP style](https://github.com/evancz/TodoFRP). The code to go from data to UI widgets is quite clean. But the widget can't handle its own update and isn't generic, but has to directly call a function to update the application state based on the specific data layout.

Om components have an extra trick up their sleeves to solve this problem. Each component receives a cursor that has both its data and a mechanism for updating that specific data. The default cursor is a zipper: a local piece of data that knows where it is in the global state tree. You call update on that piece of data, and it actually triggers an update on the correct spot in the global data. Other implementations [may be available soon](https://github.com/swannodette/om/issues/23).

This means that Om components are more modular than any other functional UI widgets I have seen: they can get handed a piece of pure data, can update just their data without knowing how it is laid out in the global state, and everything just works. 

<hr/>

<br/>

## What's next

I am hesitant to speak about the future of Om, both because David is taking it where he wants to and because I'm not yet fluent enough with Clojure and the functional style to know whether things I want are good ideas or just doing it wrong.

So here is my personal roadmap for getting more used to working in Om:

- Figure out the ClojureScript advanced compilation mode so I can get a real release-quality single-file js build.
- Clean up my vacation project, refactoring and creating some Om utilities as needed, to see how clean and readable I can make the code. 
- Try implementing generic, reusable components. I think the biggest challenge will be to establish some conventions for the shape of the data.
- Learn more core.async. I have [Timothy Baldridge's talk](http://www.youtube.com/watch?v=enwIIGzhahw) queued up to better understand how to think in channels. 
- Write an alternate cursor implementation. I'd like the component's update method to be polymorphic on the cursor it's given, so that you could write custom cursors that support their own update semantics. 

I'll be excited to follow David's work on Om and see the things we build with it.