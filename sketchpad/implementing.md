# Hen/chicken

Need to understand that it's a core data structure but is used to represent different kinds of relationships:

- Prototype/instance (lines v a line, line as a topo)
- Ownership / relationship (line ending on a point)
- Namespacing / modularization (topos as part of the universe)

> "Its data structures were hard to understand—the only vaguely familiar construct was the embedding of pointers to procedures and using a process called reverse indexing to jump through them to routines, like the 220 file system" - Kay

> "It is to be hoped that future workers can either grasp the power of generality at once and strive for it or have the courage to stumble along a trail like mine until they achieve it."

# How was it built?

- Chicken/hen as object- or generic-like programming style
  - Three ways: type-instance, namespace-member, and relation of siblings
  - Relation to OOP, parametric polymorphism, etc.
  - (Give a good visualization that uses each type)
- Merging: recursive merging of visual elements is logical unification (is this a ridiculous idea?)
- Constraint solver: first and second version, doing what's logical to UI user rather than mathematically precise

- Questions
  - Why build a recreation? Aren't there already several others?
    Discuss different goals: available to everyone on web, full UI. Describe contrasting recreations (full physical experience, just constraint solving)
  -
