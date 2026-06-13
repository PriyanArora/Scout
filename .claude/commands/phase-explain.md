Read claude/Progress.md, claude/BuildFlow.md, claude/Claude_guide.md, and claude/ProjectSummary.md.

Identify the current phase from Progress.md. Then produce a deep explanation of that phase structured exactly as follows:

---

## Phase [N] — [Name] — What You're Actually Building

**In one sentence:** [what this phase produces and why the project can't move forward without it]

---

### Why This Phase Exists

Explain the professional context. What would break, be impossible, or be painful if you skipped this phase and went straight to the next one? What does this phase unlock? Frame it in terms of how a real engineering team thinks about this stage of a project — not in terms of a tutorial checklist.

---

### Concepts You Must Understand Before Writing a Line

List every concept, term, or mental model the student needs to have clear before they start. For each:
- Name the concept
- Explain it in 2-3 sentences in plain language
- Give one concrete analogy if it helps
- Say what goes wrong when people misunderstand it

Do not assume they know anything. Do not define things they already proved they understand in earlier phases.

---

### The Shape of What You'll Build

Show the canonical skeleton/boilerplate pattern this phase produces. This is a GENERIC ILLUSTRATION of structure — not their implementation. Label it clearly. Maximum 15 lines. Use comments to explain what each part is, not how to fill it in.

Example format (adapt to project category):
```
// [what this file/module is]
// [what it receives]
// [what it returns or produces]

[structural skeleton with commented placeholders]
```

For web: show the shape of a route handler, a service function, a model definition — whichever is relevant.
For systems: show the shape of a module, a transform function, an entry point.
For creative: show the shape of a system class, a scene lifecycle, a state machine.

This is the pattern. Their job is to fill it with their logic.

---

### What Professional Developers Do Differently At This Phase

Name 3-4 specific habits that separate professional work from student work at this exact phase. Not generic advice — specific to what this phase produces. Each habit gets one sentence of what it looks like in practice.

---

### Checkpoint Breakdown

Go through every unchecked item in the current phase checkpoint. For each:
- Restate the checkpoint item in plain English
- Explain what it proves when it passes
- Give one concrete way to verify it (command to run, output to look for, behaviour to demonstrate)

---

### Common Traps at This Phase

List the 3 most common mistakes students make specifically at this phase. For each:
- Name the mistake
- Say why it happens (usually a wrong mental model)
- Say what it looks like when you've made it
- Ask one question that would reveal whether they've fallen into it

---

### Before You Write Anything — Answer These First

Pose 3-5 Socratic questions the student should be able to answer before touching the keyboard. If they can't answer these, they are not ready to start. Do not answer them — make the student answer them.

---

Do not write their implementation. Do not answer the Socratic questions. Do not soften the habit enforcement. This is a teaching explanation, not a tutorial.
