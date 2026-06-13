Read claude/Progress.md, claude/BuildFlow.md, claude/Claude_guide.md, and claude/ProjectSummary.md.

Determine the current step as follows:
- Find the current phase in Progress.md
- Find the first unchecked checkbox [ ] in that phase — that is the current step
- If the user passed a number argument (e.g. "/step-explain 3"), explain step 3 of the current phase instead
- If the user passed a name (e.g. "/step-explain env guard"), find the closest matching step

Produce a deep explanation of that single step structured exactly as follows:

---

## Step: [checkpoint item text] — Phase [N]

**What this step is in one sentence:** [plain language — what you are building and what it proves]

---

### Why This Step Is Here

Explain why this step sits in this exact position in the phase. Why does it come after the previous step? Why must it come before the next one? What breaks if you do it out of order? This is not "because the checklist says so" — explain the real engineering reason.

---

### The Core Concept

Name the underlying engineering concept or principle this step teaches. Explain it in depth:
- What is it?
- Why does it exist as a practice?
- What problem does it solve?
- What does it look like when done well vs done poorly?

Use one concrete real-world analogy. Keep it grounded — explain how a professional at a company thinks about this, not how a tutorial explains it.

---

### Syntax Template

Show the canonical pattern for this type of task. This is a GENERIC ILLUSTRATION — not their implementation. Label it clearly as a pattern. Maximum 10 lines.

Use comments to explain the purpose of each structural part. Do not fill in their specific values — use descriptive placeholders that explain what belongs there.

Adapt the template to the project's category and tech stack from ProjectSummary.md.

```
// [what this construct is]
// [what it is responsible for]

[structural skeleton — comments explain purpose of each part, not the implementation]
```

After the template, in plain text: explain what each section does and why it is structured that way. Point out the parts that students most commonly get wrong.

---

### The Proof

Explain exactly what "done" looks like for this step:
- What command do you run?
- What output do you expect to see?
- What behaviour do you need to demonstrate?
- What would a broken implementation produce instead?

Be precise. "It works" is not a proof. Describe the exact observable evidence.

---

### Questions To Ask Yourself Before Starting

Pose 3-4 Socratic questions the student must be able to answer before they write this step. If they cannot answer these, they do not understand the step yet and should not start. Do not answer them — that is the student's job.

---

### The Single Most Common Mistake

Name the one mistake students make most often on this specific step. Explain:
- What it looks like in code
- Why it seems reasonable at first
- What it breaks downstream
- One question that would reveal whether they've made it

---

### Habit Check

Identify which of the 13 habits from Claude_guide.md are most directly tested by this step. For each relevant habit, state what it looks like in practice at this exact step — not the general definition, but the specific application here.

---

Do not write their implementation. Do not answer the Socratic questions for them. If they ask you to just give them the answer after reading this, remind them: understanding this step is the point, not completing it.
