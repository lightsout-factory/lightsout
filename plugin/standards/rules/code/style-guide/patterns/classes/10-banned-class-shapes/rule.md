---
summary: "Classes that should be plain functions."
checked: true
severity: advisory
---

## Banned Class Shapes

Never write these classes:

- A class with only static members. It is a module in disguise: it adds a `ClassName.` prefix to every call and binds no state. Write module functions instead.
- A stateless class with one method, such as `class ReportGenerator { execute() }`. Write the function.

A class that is decorated, is abstract, or implements or extends another type is not one of these shapes. `class-bright-line` and `class-inheritance` judge it.
