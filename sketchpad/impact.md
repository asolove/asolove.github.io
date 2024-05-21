---
title: Understanding Sketchpad
layout: sketchpad
permalink: /sketchpad/impact
---

<canvas height="512" width="512" id="sketchpad-canvas"></canvas>

<svg width="900" height="700">
  <line x1="150" y1="100" x2="30" y2="500" stroke="black" stroke-dasharray="-2" stroke-width="1" />
  <line x1="150" y1="100" x2="30" y2="500" stroke="white" stroke-dasharray="2" stroke-width="1" />
  <line x1="150" y1="100" x2="760" y2="300" stroke="black" stroke-dasharray="-2" stroke-width="1" />
  <line x1="150" y1="100" x2="760" y2="300" stroke="white" stroke-dasharray="2" stroke-width="1" />
  <circle cx="150" cy="100" r="10" fill="blue" />
  <circle cx="30" cy="500" r="10" fill="green" />
  <circle cx="760" cy="300" r="10" fill="red" />
</svg>

# Understanding Sketchpad<br><span>&amp; its enduring impact</span>

#### The first software user interface remains one of the most interesting. What was its impact and why can it still inspire us today?

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

<hr>

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

# Bits in need of a home

"THE AS YET UNDREAMT OF THINGS THAT WILL BE DISPLAYED" (p.86)

- Odds and ends

  - Meta-object protocol side comment
    > "I considered making it belong to itself so that continued upward searching through the generic structure would appear to reach an unending string of UNIVERSE blocks, but I could find no solid reason for so doing. Further work may develop one, of course." (p.53)
  - ... re-review notes for other interesting side comments
  - Raster font
  - Concurrency bugs (p.48)
  - Windowing: zoom/pan so display shows different portions of underlying document
  - Pseudo pen location (p.66) similar to iPad cursor (probably other examples)
  - Display twinkling (p.68)
  - "Natural" v reverse scrolling:
    > "It is possible to think of moving the scope window above the page or moving the drawing beneath the window." (p.74)
  - The first lazy programmer:
    > "The rewards that came from implementing general functions are so great that the author has become reluctant to write any programs for specific jobs." (p.87)

<script>
  // src/lib.ts
function angle([x1, y1], [x2, y2]) {
  let dx = x2 - x1;
  let dy = y2 - y1;
  let collapsedAngle = Math.atan(dy / dx);
  let directionalAngle = collapsedAngle + (dx < 0 ? Math.PI : 0);
  return directionalAngle + (directionalAngle < 0 ? Math.PI * 2 : 0);
}
function distance([x1, y1], [x2, y2]) {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}
var clamp = (min, val, max) => {
  return Math.max(min, Math.min(val, max));
};
var sum = (a, b) => a + b;

// src/ring.ts
function createHen(parent) {
  let partialHen = {
    type: "hen",
    self: parent
  };
  let fakeCompleteHen = partialHen;
  fakeCompleteHen.next = fakeCompleteHen;
  fakeCompleteHen.prev = fakeCompleteHen;
  return fakeCompleteHen;
}
function clearHen(hen) {
  let current = hen.next;
  while (current.type === "chicken") {
    let next = current.next;
    emptyChicken(current);
    current = next;
  }
  hen.next = hen;
  hen.prev = hen;
}
function collectChickens(hen) {
  let r = [];
  let current = hen.next;
  while (current.type === "chicken") {
    r.push(current.self);
    current = current.next;
  }
  return r;
}
function mergeHens(hen, other) {
  if (other.next === other)
    return;
  let oldLast = hen.prev;
  oldLast.next = other.next;
  oldLast.next.prev = oldLast;
  other.prev.next = hen;
  hen.prev = other.prev;
  other.next = hen;
  other.prev = hen;
}
function isChicken(item) {
  return item && item.type === "chicken";
}
function createEmptyChicken(self) {
  let partialChicken = {
    type: "chicken",
    self
  };
  let fakeCompleteChicken = partialChicken;
  fakeCompleteChicken.next = fakeCompleteChicken;
  fakeCompleteChicken.prev = fakeCompleteChicken;
  return fakeCompleteChicken;
}
function emptyChicken(chicken) {
  chicken.next = chicken;
  chicken.prev = chicken;
}
function isEmptyChicken(chicken) {
  return chicken.next == chicken;
}
function chickenParent(chicken) {
  let current = chicken;
  while (current.type === "chicken") {
    current = current.next;
  }
  return current.self;
}
function addChicken(hen, child) {
  let lastSibling = hen.prev;
  let chicken = {
    type: "chicken",
    self: child,
    prev: lastSibling,
    next: hen
  };
  lastSibling.next = chicken;
  hen.prev = chicken;
  return chicken;
}
function removeChicken(chicken) {
  if (isEmptyChicken(chicken))
    return;
  [chicken.next.prev, chicken.prev.next] = [chicken.prev, chicken.next];
  emptyChicken(chicken);
}

// src/constraint.ts
class Constraint {
  picture;
  constructor(picture) {
    this.picture = addChicken(picture, this);
  }
  display(_d, _displayTransform) {
  }
  remove() {
    removeChicken(this.picture);
  }
}

class SameXConstraint extends Constraint {
  p1;
  p2;
  picture;
  constructor(p1, p2, picture) {
    super(picture);
    this.p1 = addChicken(p1.constraints, this);
    this.p2 = addChicken(p2.constraints, this);
    this.picture = createEmptyChicken(this);
  }
  remove() {
    super.remove();
    removeChicken(this.p1);
    removeChicken(this.p2);
  }
  get x1() {
    return chickenParent(this.p1).x;
  }
  get x2() {
    return chickenParent(this.p2).x;
  }
  error() {
    return Math.abs(this.x1 - this.x2);
  }
  name() {
    return "X";
  }
  ncon() {
    return 1;
  }
  chvar() {
    return 2;
  }
}

class SameYConstraint extends Constraint {
  p1;
  p2;
  picture;
  constructor(p1, p2, picture) {
    super(picture);
    this.p1 = addChicken(p1.constraints, this);
    this.p2 = addChicken(p2.constraints, this);
    this.picture = createEmptyChicken(this);
  }
  remove() {
    super.remove();
    removeChicken(this.p1);
    removeChicken(this.p2);
  }
  get y1() {
    return chickenParent(this.p1).y;
  }
  get y2() {
    return chickenParent(this.p2).y;
  }
  error() {
    return Math.abs(this.y1 - this.y2);
  }
  name() {
    return "Y";
  }
  ncon() {
    return 1;
  }
  chvar() {
    return 2;
  }
}

class PointOnLineConstraint extends Constraint {
  point;
  end1;
  end2;
  constructor(point, end1, end2, picture) {
    super(picture);
    this.point = addChicken(point.constraints, this);
    this.end1 = addChicken(end1.constraints, this);
    this.end2 = addChicken(end2.constraints, this);
  }
  remove() {
    super.remove();
    removeChicken(this.point);
    removeChicken(this.end1);
    removeChicken(this.end2);
  }
  get pointPosition() {
    let point = chickenParent(this.point);
    return [point.x, point.y];
  }
  get end1Position() {
    let end1 = chickenParent(this.end1);
    return [end1.x, end1.y];
  }
  get end2Position() {
    let end2 = chickenParent(this.end2);
    return [end2.x, end2.y];
  }
  error() {
    let end1 = this.end1Position;
    let end2 = this.end2Position;
    let point = this.pointPosition;
    let dist = distance(end1, point);
    let theta = angle(end1, end2) - angle(end1, point);
    let errorOrthogonal = dist * Math.sin(theta);
    let pointParallelDistance = dist * Math.cos(theta);
    let end2Distance = distance(end1, end2);
    let errorParallel = 0;
    if (pointParallelDistance < 0) {
      errorParallel = -pointParallelDistance;
    }
    if (pointParallelDistance > end2Distance) {
      errorParallel = pointParallelDistance - end2Distance;
    }
    return Math.sqrt(Math.pow(errorOrthogonal, 2) + Math.pow(errorParallel, 2));
  }
  name() {
    return "L";
  }
  ncon() {
    return 2;
  }
  chvar() {
    return 2;
  }
}
class PointOnArcConstraint extends Constraint {
  point;
  center;
  start;
  end;
  constructor(point, center, start, end, picture) {
    super(picture);
    this.point = addChicken(point.constraints, this);
    this.center = addChicken(center.constraints, this);
    this.start = addChicken(start.constraints, this);
    this.end = addChicken(end.constraints, this);
  }
  remove() {
    super.remove();
    removeChicken(this.point);
    removeChicken(this.center);
    removeChicken(this.start);
    removeChicken(this.end);
  }
  get pointPosition() {
    let point = chickenParent(this.point);
    return [point.x, point.y];
  }
  get centerPosition() {
    let center = chickenParent(this.center);
    return [center.x, center.y];
  }
  get startPosition() {
    let start = chickenParent(this.start);
    return [start.x, start.y];
  }
  get endPosition() {
    let end = chickenParent(this.end);
    return [end.x, end.y];
  }
  error() {
    let center = this.centerPosition;
    let start = this.startPosition;
    let end = this.endPosition;
    let point = this.pointPosition;
    let dist = distance(center, point);
    let radius = distance(center, start);
    let radiusError = Math.abs(radius - dist);
    let startAngle = angle(center, start);
    let endAngle = angle(center, end);
    let pointAngle = angle(center, point);
    if (endAngle <= startAngle)
      endAngle += 2 * Math.PI;
    let angleError = 0;
    if (pointAngle < startAngle) {
      angleError = radius * (startAngle - pointAngle);
    } else if (pointAngle > endAngle) {
      angleError = radius * (pointAngle - endAngle);
    }
    return Math.sqrt(Math.pow(radiusError, 2) + Math.pow(angleError, 2));
  }
  name() {
    return "C";
  }
  ncon() {
    return 2;
  }
  chvar() {
    return 4;
  }
}

class SameDistanceConstraint extends Constraint {
  pa1;
  pa2;
  pb1;
  pb2;
  constructor(pa1, pa2, pb1, pb2, picture) {
    super(picture);
    this.pa1 = addChicken(pa1.constraints, this);
    this.pa2 = addChicken(pa2.constraints, this);
    this.pb1 = addChicken(pb1.constraints, this);
    this.pb2 = addChicken(pb2.constraints, this);
  }
  remove() {
    super.remove();
    removeChicken(this.pa1);
    removeChicken(this.pa2);
    removeChicken(this.pb1);
    removeChicken(this.pb2);
  }
  error() {
    let da = distance(chickenParent(this.pa1).position, chickenParent(this.pa2).position);
    let db = distance(chickenParent(this.pb1).position, chickenParent(this.pb2).position);
    return Math.abs(db - da);
  }
  name() {
    return "P";
  }
  ncon() {
    return 1;
  }
  chvar() {
    return 4;
  }
}

class PerpendicularConstraint extends Constraint {
  pa1;
  pa2;
  pb1;
  pb2;
  constructor(pa1, pa2, pb1, pb2, picture) {
    super(picture);
    this.pa1 = addChicken(pa1.constraints, this);
    this.pa2 = addChicken(pa2.constraints, this);
    this.pb1 = addChicken(pb1.constraints, this);
    this.pb2 = addChicken(pb2.constraints, this);
  }
  remove() {
    super.remove();
    removeChicken(this.pa1);
    removeChicken(this.pa2);
    removeChicken(this.pb1);
    removeChicken(this.pb2);
  }
  error() {
    let pa1 = chickenParent(this.pa1).position;
    let pa2 = chickenParent(this.pa2).position;
    let pb1 = chickenParent(this.pb1).position;
    let pb2 = chickenParent(this.pb2).position;
    let minD = Math.min(distance(pa1, pa2), distance(pb1, pb2));
    let angle1 = angle(pa1, pa2);
    let angle2 = angle(pb1, pb2);
    return Math.abs(Math.cos(Math.abs(angle2 - angle1)) * minD);
  }
  name() {
    return "+";
  }
  ncon() {
    return 1;
  }
  chvar() {
    return 4;
  }
}

class ParallelConstraint extends Constraint {
  pa1;
  pa2;
  pb1;
  pb2;
  constructor(pa1, pa2, pb1, pb2, picture) {
    super(picture);
    this.pa1 = addChicken(pa1.constraints, this);
    this.pa2 = addChicken(pa2.constraints, this);
    this.pb1 = addChicken(pb1.constraints, this);
    this.pb2 = addChicken(pb2.constraints, this);
  }
  remove() {
    super.remove();
    removeChicken(this.pa1);
    removeChicken(this.pa2);
    removeChicken(this.pb1);
    removeChicken(this.pb2);
  }
  error() {
    let pa1 = chickenParent(this.pa1).position;
    let pa2 = chickenParent(this.pa2).position;
    let pb1 = chickenParent(this.pb1).position;
    let pb2 = chickenParent(this.pb2).position;
    let minD = Math.min(distance(pa1, pa2), distance(pb1, pb2));
    let angle1 = angle(pa1, pa2);
    let angle2 = angle(pb1, pb2);
    return Math.abs(Math.sin(Math.abs(angle2 - angle1)) * minD);
  }
  name() {
    return "=";
  }
  ncon() {
    return 1;
  }
  chvar() {
    return 4;
  }
}

// src/document.ts
class Universe {
  currentPicture;
  pictures;
  movings;
  #runConstraints;
  constraintTimeout;
  constructor() {
    this.currentPicture = new Picture;
    this.pictures = [this.currentPicture];
    this.movings = createHen(this);
    this.#runConstraints = false;
  }
  set runConstraints(value) {
    if (this.constraintTimeout) {
      clearTimeout(this.constraintTimeout);
      this.constraintTimeout = undefined;
    }
    this.#runConstraints = value;
    if (this.#runConstraints)
      this.loop();
  }
  loop() {
    this.pictures.flatMap((p) => collectChickens(p.variables)).map((v) => v.satisfyConstraints());
    this.constraintTimeout = setTimeout(() => this.loop(), 10);
  }
  addPicture() {
    let p = new Picture;
    this.pictures.push(p);
    this.currentPicture = p;
    clearHen(this.movings);
    return p;
  }
  addMovings(items) {
    items.forEach((item) => item.startMoving(this.movings));
  }
  clearMovings() {
    clearHen(this.movings);
  }
  moveMovings([dx, dy]) {
    let moveds = new Set;
    collectChickens(this.movings).forEach((moving) => moving.move(dx, dy, moveds));
  }
  addPointInLineSegment(position) {
    let picture = this.currentPicture;
    let current = this.movings.next;
    if (isChicken(current.next))
      throw new Error("Cannot draw line while more than one item is moving");
    if (isChicken(current) && !(current.self instanceof Point))
      throw new Error("Cannot draw line while current moving is not a Point.");
    let p1 = position instanceof Point ? position : picture.addPoint(position);
    let p0 = current.self instanceof Point ? current.self : picture.addPoint([p1.x, p1.y]);
    let l = picture.addLine(p0, p1);
    if (isChicken(current))
      removeChicken(current);
    addChicken(this.movings, p1);
    return p1;
  }
  display(d, dt) {
    this.currentPicture.display(d, dt);
  }
}

class Picture {
  parts;
  variables;
  constraints;
  attachers;
  instances;
  constructor() {
    this.parts = createHen(this);
    this.variables = createHen(this);
    this.constraints = createHen(this);
    this.attachers = createHen(this);
    this.instances = createHen(this);
  }
  display(d, dt) {
    let current = this.parts.next;
    while (isChicken(current)) {
      current.self.display(d, dt);
      current = current.next;
    }
  }
  addSameXConstraint(p1, p2) {
    return new SameXConstraint(p1, p2, this.constraints);
  }
  addSameYConstraint(p1, p2) {
    return new SameYConstraint(p1, p2, this.constraints);
  }
  addPointOnLineConstraint(p, end1, end2) {
    return new PointOnLineConstraint(p, end1, end2, this.constraints);
  }
  addPointOnArcConstraint(p, center, start, end) {
    return new PointOnArcConstraint(p, center, start, end, this.constraints);
  }
  addSameDistanceConstraint(pa1, pa2, pb1, pb2) {
    return new SameDistanceConstraint(pa1, pa2, pb1, pb2, this.constraints);
  }
  addPerpendicularConstraint(pa1, pa2, pb1, pb2) {
    return new PerpendicularConstraint(pa1, pa2, pb1, pb2, this.constraints);
  }
  addParallelConstraint(pa1, pa2, pb1, pb2) {
    return new ParallelConstraint(pa1, pa2, pb1, pb2, this.constraints);
  }
  addPoint(position) {
    return new Point(position, this.parts, this.variables);
  }
  addLine(start, end) {
    return new Line(start.linesAndArcs, end.linesAndArcs, this.parts);
  }
  addArc(center, start, end) {
    let arc = new Arc(center.linesAndArcs, start.linesAndArcs, end.linesAndArcs, this.parts);
    this.addPointOnArcConstraint(end, center, start, end);
    return arc;
  }
  addInstance(ofPicture, cx = 0, cy = 0, zoom = 1, rotation = 0) {
    return new Instance(this.variables, this.parts, ofPicture, [cx, cy], zoom, rotation);
  }
}

class Variable {
  isVariable;
  constraints;
  constructor(variables) {
    this.isVariable = addChicken(variables, this);
    this.constraints = createHen(this);
  }
  error() {
    let cs = collectChickens(this.constraints);
    return cs.map((c) => Math.pow(c.error(), 2)).reduce(sum, 0);
  }
  merge(other) {
    removeChicken(other.isVariable);
    mergeHens(this.constraints, other.constraints);
    return this;
  }
  remove() {
    removeChicken(this.isVariable);
    collectChickens(this.constraints).forEach((c) => c.remove());
  }
}

class Instance extends Variable {
  cx;
  cy;
  zoom;
  rotation;
  inPicture;
  ofPicture;
  constructor(variables, inPicture, ofPicture, [cx, cy] = [0, 0], zoom = 0.5, rotation = 0) {
    super(variables);
    this.cx = cx;
    this.cy = cy;
    this.zoom = zoom;
    this.rotation = rotation;
    this.inPicture = addChicken(inPicture, this);
    this.ofPicture = addChicken(ofPicture.instances, this);
  }
  error() {
    let cs = collectChickens(this.constraints);
    return cs.map((c) => c.error()).reduce(sum, 0);
  }
  display(d, displayTransform) {
    const dt = ([x, y]) => {
      let scaledX = x * this.zoom;
      let scaledY = y * this.zoom;
      return displayTransform([
        scaledX * Math.cos(this.rotation) - scaledY * Math.sin(this.rotation) + this.cx,
        scaledX * Math.sin(this.rotation) + scaledY * Math.cos(this.rotation) + this.cy
      ]);
    };
    let instance = this;
    let drawonableWithoutAttribution = {
      drawPoint(point, item) {
        return d.drawPoint(point, instance);
      },
      drawLine(start, end, item) {
        return d.drawLine(start, end, instance);
      }
    };
    chickenParent(this.ofPicture).display(drawonableWithoutAttribution, dt);
  }
  satisfyConstraints() {
  }
}

class Arc {
  center;
  start;
  end;
  attacher;
  picture;
  moving;
  constructor(center, start, end, picture) {
    this.center = addChicken(center, this);
    this.start = addChicken(start, this);
    this.end = addChicken(end, this);
    this.picture = addChicken(picture, this);
    this.attacher = createEmptyChicken(this);
    this.moving = createEmptyChicken(this);
  }
  remove() {
    removeChicken(this.center);
    removeChicken(this.start);
    removeChicken(this.end);
    removeChicken(this.picture);
    removeChicken(this.attacher);
    removeChicken(this.moving);
  }
  isMoving() {
    return !isEmptyChicken(this.moving);
  }
  startMoving(movings) {
    this.moving = addChicken(movings, this);
  }
  endMoving() {
    removeChicken(this.moving);
  }
  get centerPosition() {
    return chickenParent(this.center).position;
  }
  get startPosition() {
    return chickenParent(this.start).position;
  }
  get endPosition() {
    return chickenParent(this.end).position;
  }
  display(d, dt) {
    let center = this.centerPosition;
    let start = this.startPosition;
    let end = this.endPosition;
    let [cx, cy] = center;
    let [x, y] = start;
    let r = distance(center, start);
    let startAngle = angle(center, start);
    let endAngle = angle(center, end);
    if (endAngle <= startAngle) {
      endAngle += 2 * Math.PI;
    }
    let arcRadians = endAngle - startAngle;
    if (arcRadians < 0)
      arcRadians += 2 * Math.PI;
    let steps = 0;
    while (steps++ < arcRadians * r) {
      d.drawPoint(dt([x, y]), this);
      x = x - 1 / r * (y - cy);
      y = y + 1 / r * (x - cx);
    }
  }
  move(dx, dy, moved) {
  }
  constrainPoint(point) {
    chickenParent(this.picture).addPointOnArcConstraint(point, chickenParent(this.center), chickenParent(this.start), chickenParent(this.end));
  }
}

class Line {
  start;
  end;
  attacher;
  picture;
  moving;
  constructor(start, end, picture) {
    this.start = addChicken(start, this);
    this.end = addChicken(end, this);
    this.picture = addChicken(picture, this);
    this.attacher = createEmptyChicken(this);
    this.moving = createEmptyChicken(this);
  }
  remove() {
    removeChicken(this.start);
    removeChicken(this.end);
    removeChicken(this.picture);
    removeChicken(this.attacher);
    removeChicken(this.moving);
  }
  isMoving() {
    return !isEmptyChicken(this.moving);
  }
  startMoving(movings) {
    this.moving = addChicken(movings, this);
  }
  endMoving() {
    removeChicken(this.moving);
  }
  display(d, dt) {
    d.drawLine(dt(this.startPosition), dt(this.endPosition), this);
  }
  move(dx, dy, moved) {
  }
  bounds() {
    return { xMin: 0, xMax: 0, yMin: 0, yMax: 0 };
  }
  get startPoint() {
    return chickenParent(this.start);
  }
  get endPoint() {
    return chickenParent(this.end);
  }
  get startPosition() {
    let p = this.startPoint;
    return [p.x, p.y];
  }
  get endPosition() {
    let p = this.endPoint;
    return [p.x, p.y];
  }
  constrainPoint(point) {
    chickenParent(this.picture).addPointOnLineConstraint(point, this.startPoint, this.endPoint);
  }
}

class Point extends Variable {
  x;
  y;
  attacher;
  picture;
  linesAndArcs;
  instancePointConstraints;
  moving;
  constructor([x, y], picture, variables) {
    super(variables);
    this.x = x;
    this.y = y;
    this.picture = addChicken(picture, this);
    this.instancePointConstraints = createHen(this);
    this.linesAndArcs = createHen(this);
    this.moving = createEmptyChicken(this);
    this.attacher = createEmptyChicken(this);
  }
  remove() {
    super.remove();
    removeChicken(this.picture);
    collectChickens(this.linesAndArcs).forEach((s) => s.remove());
  }
  merge(other) {
    this.x = other.x;
    this.y = other.y;
    mergeHens(this.instancePointConstraints, other.instancePointConstraints);
    mergeHens(this.linesAndArcs, other.linesAndArcs);
    if (isEmptyChicken(this.moving)) {
      other.moving.self = this;
    } else {
      removeChicken(other.moving);
    }
    if (isEmptyChicken(this.attacher)) {
      other.attacher.self = this;
    } else {
      removeChicken(other.attacher);
    }
    super.merge(other);
    removeChicken(other.picture);
    return this;
  }
  isMoving() {
    return !isEmptyChicken(this.moving);
  }
  startMoving(movings) {
    this.moving = addChicken(movings, this);
  }
  endMoving() {
    removeChicken(this.moving);
  }
  satisfyConstraints() {
    let minDifference = 0.5;
    let e0 = this.error();
    this.x += 1;
    let exp = this.error();
    this.x -= 2;
    let exn = this.error();
    this.x += 1;
    if (exp < exn && e0 - exp > minDifference) {
      this.x += 1;
      e0 = exp;
    } else if (e0 - exn > minDifference) {
      this.x -= 1;
      e0 = exn;
    }
    this.y += 1;
    let eyp = this.error();
    this.y -= 2;
    let eyn = this.error();
    this.y += 1;
    if (eyp < eyn && e0 - eyp > minDifference) {
      this.y += 1;
    } else if (e0 - eyn > minDifference) {
      this.y -= 1;
    }
  }
  display(d, dt) {
    d.drawPoint(dt([this.x, this.y]), this);
  }
  move(dx, dy, moveds) {
    if (moveds.has(this))
      return;
    this.x += dx;
    this.y += dy;
    moveds.add(this);
  }
  bounds() {
    return { xMin: 0, xMax: 0, yMin: 0, yMax: 0 };
  }
  get position() {
    return [this.x, this.y];
  }
}

// src/display.ts
class DisplayFile {
  pixels;
  cx;
  cy;
  zoom;
  logicalWidth = 1024;
  logicalHeight = 1024;
  mousePosition;
  pointNearestCursor;
  shapesNearCursor;
  constructor() {
    this.cx = 0;
    this.cy = 0;
    this.zoom = 0.5;
    this.pixels = [];
    this.mousePosition = [0, 0];
    this.pointNearestCursor = undefined;
    this.shapesNearCursor = new Set;
  }
  displayTransform() {
    return ([x, y]) => {
      return [
        Math.round((x - this.cx) * this.zoom) + this.logicalWidth / 2,
        Math.round((this.cy - y) * this.zoom) + this.logicalHeight / 2
      ];
    };
  }
  inverseDisplayTransform() {
    return ([x, y]) => {
      return [
        (x - this.logicalWidth / 2) / this.zoom + this.cx,
        -(y - this.logicalHeight / 2) / this.zoom + this.cy
      ];
    };
  }
  clear() {
    this.pixels = [];
    this.pointNearestCursor = undefined;
    this.shapesNearCursor.clear();
  }
  twinkle() {
    let times = this.pixels.length;
    for (let i = 0;i < times; i++) {
      let j = Math.floor(Math.random() * times);
      let k = Math.floor(Math.random() * times);
      [this.pixels[j], this.pixels[k]] = [this.pixels[k], this.pixels[j]];
    }
  }
  drawPoint([x, y], item) {
    if (x < 0 || x > this.logicalWidth)
      return;
    if (y < 0 || y > this.logicalHeight)
      return;
    this.pixels.push([x, y]);
    if (item instanceof Point) {
      if (!isEmptyChicken(item.moving))
        return;
      let d = distance([x, y], this.mousePosition);
      if (d > 6)
        return;
      let dCurrent = this.pointNearestCursor ? distance(this.pointNearestCursor.position, this.mousePosition) : Infinity;
      if (d > dCurrent)
        return;
      this.pointNearestCursor = item;
    } else if (item instanceof Arc || item instanceof Line) {
      if (!isEmptyChicken(item.moving))
        return;
      let d = distance([x, y], this.mousePosition);
      if (d > 4)
        return;
      this.shapesNearCursor.add(item);
    }
  }
  drawLine([x1, y1], [x2, y2], item) {
    let xdiff = Math.abs(x2 - x1);
    let ydiff = Math.abs(y2 - y1);
    let steps = Math.max(xdiff, ydiff);
    let dx = (x2 - x1) / steps;
    let dy = (y2 - y1) / steps;
    let x = x1;
    let y = y1;
    for (let i = 0;i < steps; i++) {
      let xNext = x + dx;
      let yNext = y + dy;
      this.drawPoint([Math.round(xNext), Math.round(yNext)], item);
      x = xNext;
      y = yNext;
    }
  }
}
class Mode {
  universe;
  displayFile;
  constructor(universe, displayFile) {
    this.universe = universe;
    this.displayFile = displayFile;
  }
  cursorMoved(dx, dy) {
  }
  buttonDown(position) {
  }
  buttonUp(position) {
  }
  cleanup() {
  }
}

class LineMode extends Mode {
  constructor() {
    super(...arguments);
  }
  movingPoint;
  buttonDown(position) {
    if (this.displayFile.pointNearestCursor && this.movingPoint) {
      this.displayFile.pointNearestCursor.merge(this.movingPoint);
      this.universe.clearMovings();
      this.movingPoint = undefined;
    } else {
      let toPoint = this.universe.currentPicture.addPoint(position);
      let fromPoint = this.movingPoint || this.displayFile.pointNearestCursor || this.universe.currentPicture.addPoint(position);
      this.universe.currentPicture.addLine(fromPoint, toPoint);
      if (!this.displayFile.pointNearestCursor) {
        this.displayFile.shapesNearCursor.forEach((shape) => {
          shape.constrainPoint(fromPoint);
        });
      }
      this.universe.clearMovings();
      this.universe.addMovings([toPoint]);
      this.movingPoint = toPoint;
    }
  }
  cursorMoved(dx, dy) {
    this.universe.moveMovings([dx, dy]);
  }
  cleanup() {
    this.universe.clearMovings();
  }
}

class PauseMode extends Mode {
  constructor(universe, displayFile) {
    super(universe, displayFile);
    this.universe.runConstraints = false;
    const { constraints, parts } = this.universe.currentPicture;
    console.log({
      constraints: collectChickens(constraints),
      parts: collectChickens(parts)
    });
  }
  cleanup() {
    this.universe.runConstraints = true;
  }
}

class ArcMode extends Mode {
  constructor() {
    super(...arguments);
  }
  arc;
  next;
  makeCurrentPoint(position) {
    let nearPoint = this.displayFile.pointNearestCursor;
    if (nearPoint)
      return nearPoint;
    let newPoint = this.universe.currentPicture.addPoint(position);
    this.displayFile.shapesNearCursor.forEach((shape) => {
      shape.constrainPoint(newPoint);
    });
    return newPoint;
  }
  buttonUp(position) {
    if (!this.arc) {
      let center = this.makeCurrentPoint(position);
      let start = this.universe.currentPicture.addPoint(position);
      let end = this.universe.currentPicture.addPoint(position);
      this.arc = this.universe.currentPicture.addArc(center, start, end);
      this.universe.addMovings([start, end]);
      this.next = "start";
      this.universe.runConstraints = false;
    } else if (this.next === "start") {
      let currentPoint = this.makeCurrentPoint(position);
      currentPoint.merge(chickenParent(this.arc.start));
      this.universe.clearMovings();
      this.universe.addMovings([chickenParent(this.arc.end)]);
      this.next = "end";
    } else {
      let currentPoint = this.makeCurrentPoint(position);
      currentPoint.merge(chickenParent(this.arc.end));
      this.universe.clearMovings();
      this.arc = undefined;
      this.universe.runConstraints = true;
    }
  }
  cursorMoved(dx, dy) {
    this.universe.moveMovings([dx, dy]);
  }
  cleanup() {
    this.universe.clearMovings();
    this.universe.runConstraints = true;
  }
}

class MoveMode extends Mode {
  constructor() {
    super(...arguments);
  }
  state = "waiting";
  buttonDown(_position) {
    if (this.state != "waiting") {
      console.error(`Received buttonDown in unexpected state: ${this.state}`);
      return;
    }
    if (this.displayFile.pointNearestCursor) {
      this.state = "dragging";
      this.universe.addMovings([this.displayFile.pointNearestCursor]);
      this.universe.runConstraints = false;
    } else {
      this.state = "panning";
    }
  }
  cursorMoved(dx, dy) {
    switch (this.state) {
      case "dragging":
        this.universe.moveMovings([dx, dy]);
        return;
      case "panning":
        this.displayFile.cx -= dx;
        this.displayFile.cy -= dy;
        return;
    }
  }
  buttonUp() {
    this.universe.clearMovings();
    this.universe.runConstraints = true;
    this.state = "waiting";
  }
  cleanup() {
    this.universe.clearMovings();
    this.universe.runConstraints = true;
  }
}
class PerpendicularConstraintMode extends Mode {
  constructor() {
    super(...arguments);
  }
  state = { state: "start" };
  buttonDown(_position) {
    function isLine(shape) {
      return shape instanceof Line;
    }
    let currentLine = [...this.displayFile.shapesNearCursor].find(isLine);
    if (this.state.state === "start") {
      if (currentLine)
        this.state = { state: "first", previousLine: currentLine };
    } else {
      if (currentLine) {
        let firstLine = this.state.previousLine;
        this.universe.currentPicture.addPerpendicularConstraint(firstLine.startPoint, firstLine.endPoint, currentLine.startPoint, currentLine.endPoint);
        this.state.previousLine = currentLine;
      }
    }
  }
}

class Display {
  #universe;
  #displayFile;
  #canvas;
  #pixelsPerDraw = 2000;
  #pixelIndex = 0;
  #mode;
  constructor(df, canvas, universe) {
    this.#displayFile = df;
    this.#canvas = canvas;
    this.#universe = universe;
    let xScale = canvas.width / this.#displayFile.logicalWidth;
    let yScale = canvas.height / this.#displayFile.logicalHeight;
    canvas.getContext("2d")?.scale(xScale, yScale);
    this.#mode = new MoveMode(universe, df);
    this.loop();
    this.#canvas.style.cursor = "none";
    this.#canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      let zoom = this.#displayFile.zoom;
      zoom += e.deltaY * -0.01;
      zoom = clamp(0.1, zoom, 10);
      this.#displayFile.zoom = zoom;
    });
    let prevMX = 0;
    let prevMY = 0;
    let docPosition = (canvasPosition) => this.#displayFile.inverseDisplayTransform()(canvasPosition);
    this.#canvas.addEventListener("mousemove", (e) => {
      let mx = e.offsetX / xScale;
      let my = e.offsetY / yScale;
      this.#displayFile.mousePosition = [mx, my];
      let dx = (mx - prevMX) / this.#displayFile.zoom;
      let dy = -(my - prevMY) / this.#displayFile.zoom;
      this.#mode.cursorMoved(dx, dy);
      prevMX = mx;
      prevMY = my;
    });
    this.#canvas.addEventListener("mousedown", (e) => {
      this.#mode.buttonDown(this.#displayFile.inverseDisplayTransform()([
        e.offsetX / xScale,
        e.offsetY / yScale
      ]));
    });
    this.#canvas.addEventListener("mouseup", (e) => {
      this.#mode.buttonUp(this.#displayFile.inverseDisplayTransform()([
        e.offsetX / xScale,
        e.offsetY / yScale
      ]));
    });
    this.#canvas.ownerDocument.addEventListener("keyup", (e) => {
      let key = e.key;
      let modeClass = key === "l" ? LineMode : key === "m" ? MoveMode : key === "a" ? ArcMode : key === "c" ? PerpendicularConstraintMode : key === "p" ? PauseMode : undefined;
      if (modeClass && !(this.#mode instanceof modeClass)) {
        this.#mode.cleanup();
        this.#mode = new modeClass(this.#universe, this.#displayFile);
      }
    });
  }
  loop() {
    this.#displayFile.twinkle();
    this.render();
    requestAnimationFrame(() => this.loop());
  }
  render() {
    const ctx = this.#canvas.getContext("2d");
    if (!ctx)
      throw new Error("canot get canvas context");
    ctx.fillStyle = "rgb(30 30 30 / 40%)";
    ctx.fillRect(0, 0, this.#displayFile.logicalWidth, this.#displayFile.logicalHeight);
    ctx.fillStyle = "rgb(210 240 255 / 50%)";
    const pixels = this.#displayFile.pixels;
    if (pixels.length > 0) {
      let i = this.#pixelIndex;
      for (let j = 0;j < this.#pixelsPerDraw; j++) {
        i = (i + 1) % pixels.length;
        ctx.beginPath();
        ctx.arc(pixels[i][0], pixels[i][1], 1, 0, 2 * Math.PI);
        ctx.fill();
      }
      this.#pixelIndex = i;
    }
    let CURSOR_SIZE = 30;
    let CURSOR_STROKE = 2;
    let [mx, my] = this.#displayFile.mousePosition;
    ctx.fillRect(mx - CURSOR_SIZE / 2, my - CURSOR_STROKE / 2, CURSOR_SIZE, CURSOR_STROKE);
    ctx.fillRect(mx - CURSOR_STROKE / 2, my - CURSOR_SIZE / 2, CURSOR_STROKE, CURSOR_SIZE);
  }
}

// web/index.ts
var canvas = document.getElementById("sketchpad-canvas");
if (!canvas)
  throw new Error("Can't find canvas");
var u = new Universe;
u.runConstraints = true;
var arrowPic = u.currentPicture;
u.addPointInLineSegment([0, 100]);
var p1 = u.addPointInLineSegment([-20, 80]);
u.addPointInLineSegment([0, 100]);
var p2 = u.addPointInLineSegment([20, 80]);
u.addPointInLineSegment([0, 100]);
u.addPointInLineSegment([0, -100]);
var p3 = u.addPointInLineSegment([-20, -80]);
u.addPointInLineSegment([0, -100]);
var p4 = u.addPointInLineSegment([20, -80]);
arrowPic.addSameYConstraint(p1, p2);
arrowPic.addSameXConstraint(p1, p3);
arrowPic.addSameXConstraint(p2, p4);
arrowPic.addSameYConstraint(p3, p4);
var flowerPic = u.addPicture();
flowerPic.addInstance(arrowPic, 0, 0, 1, 0);
flowerPic.addInstance(arrowPic, 0, 0, 1, Math.PI / 6);
flowerPic.addInstance(arrowPic, 0, 0, 1, Math.PI / 3);
flowerPic.addInstance(arrowPic, 0, 0, 1, 3 * Math.PI / 6);
flowerPic.addInstance(arrowPic, 0, 0, 1, 2 * Math.PI / 3);
flowerPic.addInstance(arrowPic, 0, 0, 1, 5 * Math.PI / 6);
var rivetPic = u.addPicture();
var topLeft = rivetPic.addPoint([-90, 100]);
var topRight = rivetPic.addPoint([100, 90]);
var bottomLeft = rivetPic.addPoint([-100, -110]);
var bottomRight = rivetPic.addPoint([200, -150]);
var center = rivetPic.addPoint([0, 0]);
var cStart = rivetPic.addPoint([250, 100]);
var cEnd = rivetPic.addPoint([-250, 100]);
rivetPic.addPointOnLineConstraint(center, topLeft, bottomRight);
rivetPic.addPointOnLineConstraint(center, topRight, bottomLeft);
rivetPic.addPointOnLineConstraint(topLeft, cStart, cEnd);
rivetPic.addPointOnLineConstraint(topRight, cStart, cEnd);
rivetPic.addPerpendicularConstraint(topLeft, bottomLeft, bottomLeft, bottomRight);
rivetPic.addPerpendicularConstraint(bottomLeft, bottomRight, bottomRight, topRight);
rivetPic.addParallelConstraint(bottomLeft, bottomRight, cStart, cEnd);
rivetPic.addLine(topLeft, bottomLeft);
rivetPic.addLine(bottomLeft, bottomRight);
rivetPic.addLine(bottomRight, topRight);
rivetPic.addLine(cStart, cEnd);
rivetPic.addArc(center, cStart, cEnd);
var hexagonPic = u.addPicture();
var c = hexagonPic.addPoint([0, 0]);
var start = hexagonPic.addPoint([200, 0]);
hexagonPic.addArc(c, start, start);
var h1 = hexagonPic.addPoint([200, 0]);
var h2 = hexagonPic.addPoint([80, -160]);
hexagonPic.addLine(h1, h2);
var h3 = hexagonPic.addPoint([-60, -160]);
hexagonPic.addLine(h2, h3);
var h4 = hexagonPic.addPoint([-190, 10]);
hexagonPic.addLine(h3, h4);
var h5 = hexagonPic.addPoint([-70, 140]);
hexagonPic.addLine(h4, h5);
var h6 = hexagonPic.addPoint([70, 150]);
hexagonPic.addLine(h5, h6);
hexagonPic.addLine(h6, h1);
hexagonPic.addPointOnArcConstraint(h1, c, start, start);
hexagonPic.addPointOnArcConstraint(h2, c, start, start);
hexagonPic.addPointOnArcConstraint(h3, c, start, start);
hexagonPic.addPointOnArcConstraint(h4, c, start, start);
hexagonPic.addPointOnArcConstraint(h5, c, start, start);
hexagonPic.addPointOnArcConstraint(h6, c, start, start);
hexagonPic.addSameDistanceConstraint(h1, h2, h2, h3);
hexagonPic.addSameDistanceConstraint(h2, h3, h3, h4);
hexagonPic.addSameDistanceConstraint(h3, h4, h5, h6);
hexagonPic.addSameDistanceConstraint(h4, h5, h6, h1);
var arcConstraintPic = u.addPicture();
{
  let p12 = arcConstraintPic.addPoint([100, 0]);
  let p22 = arcConstraintPic.addPoint([-100, 0]);
  let p32 = arcConstraintPic.addPoint([50, -50]);
  let l1 = arcConstraintPic.addLine(p12, p22);
  let l2 = arcConstraintPic.addLine(p12, p32);
  let l3 = arcConstraintPic.addLine(p32, p22);
  let arc = arcConstraintPic.addArc(p32, p12, p22);
}
var combinedPic = u.addPicture();
combinedPic.addInstance(rivetPic, -400, -400, 1, 0);
combinedPic.addInstance(hexagonPic, 0, 0, 1, 0);
combinedPic.addInstance(flowerPic, 400, 400, 2, 0);
combinedPic.addInstance(arcConstraintPic, -500, 300, 1, 0);
var df = new DisplayFile;
df.zoom = 0.75;
var loop = () => {
  df.clear();
  u.display(df, df.displayTransform());
  requestAnimationFrame(loop);
};
loop();
var d = new Display(df, canvas, u);
</script>
