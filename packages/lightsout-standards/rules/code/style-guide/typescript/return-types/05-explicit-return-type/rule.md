---
summary: "When a function's return type is written out."
checked: true
severity: blocking
---

## Explicit Return Type

Declare the return type of every exported function. Leave it to inference everywhere else.

- An exported function needs none when its type is already written elsewhere: a generic signature, a method implementing an interface, or a variable typed with a function type.
- Keep an annotation on an internal function only when removing it changes what the compiler accepts, such as a recursive helper.
- An existing exported function gains its return type when you next edit it.

The return type is the output half of an export's contract. Written out, a change to it shows in the diff and fails where it is defined, not in a caller.
