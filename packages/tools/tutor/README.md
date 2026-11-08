# @effect/tutor

Learn Effect with an AI agent as your tutor. The agent asks questions and checks your code. You write the code.

This is a preview. Your feedback decides what changes.

## Requirements

- Node.js 24 or later
- pnpm and git
- One AI coding agent: Claude Code, opencode, or Codex

## Install

Clone the branch and install the dependencies:

```sh
git clone --branch tutor https://github.com/f15u/effect.git
cd effect
pnpm install
```

To update, run `git pull` and `pnpm install` in the clone. The command runs the source files directly, so no build step is needed.

## Start a lesson

Run every command in the `scratchpad` folder of the clone. Git ignores the files that the tutor writes there.

1. Check that the CLI works. The command prints a list of goals.

   ```sh
   cd scratchpad
   pnpm effect-tutor learn status
   ```

2. Register the tutor with your agent. The command shows each change and asks before it applies it.

   ```sh
   pnpm effect-tutor learn setup
   ```

3. Start your agent with `pnpm exec`. This puts `effect-tutor` on the `PATH` of the agent, so the agent can start the tutor. Claude Code asks once to approve the project `.mcp.json`. Approve it.

   ```sh
   pnpm exec claude
   ```

   For the other agents, run `pnpm exec opencode` or `pnpm exec codex`.

4. Send any message, for example `Teach me Effect`. The agent shows the goals and asks which one you want.

The tutor writes its progress to `.effect-tutor.json` in `scratchpad`. Delete the file to start again.

Do not start the agent without `pnpm exec`. The agent then cannot find `effect-tutor`, and it has no tutor tools.

## What to expect

- The agent asks one short question at a time.
- The agent never writes the code for you. It gives hints in steps.
- You ask the agent for the solution when you want it.
- The agent checks your file after each edit. Your code must compile and pass a goal test.
- The exercise uses the `effect` version of the clone.

## Send feedback

Tell us about each of these:

- A step where the agent was wrong, rude, or confusing.
- A hint that did not help, or gave away too much.
- A goal test that failed on correct code, or passed on wrong code.
- A command or message that you did not understand.
- Something that took too long.

Include this information:

```sh
node --version
git rev-parse HEAD   # run in the clone
```

- The name and version of your agent.
- The goal id, for example `handle-all-errors`.
- The content of `.effect-tutor.json`.
- The last messages of the conversation, if you can share them.

## Uninstall

Delete the clone. Remove the `tutor` entry from your agent's config:

- Claude Code: `claude mcp remove tutor`
- Codex: delete the `tutor` entry in `~/.codex/config.toml`
- opencode: delete the `tutor` entry in `opencode.json`
