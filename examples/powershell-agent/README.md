# An agent in PowerShell, in four steps

Companion code for **PowerShell Taught Me What an Agent Is**.

There is no SDK for this in PowerShell, which is the point. Everything a library
would hide — building the request, reading the response, running the tool, resending the
conversation — is written out here in a language a lot of us already know.

## Running it

```powershell
$env:ANTHROPIC_API_KEY = 'sk-ant-...'
.\step1_one_call.ps1
```

Windows PowerShell 5.1 or PowerShell 7. No modules, no install. Each file stands alone and
repeats what came before it, so you can read any one of them start to finish.

They run on `claude-haiku-4-5` — the cheapest thing that does the job, because the point is
to watch the mechanism, not to get good answers.

## The four steps

| File | What it adds | What it shows |
| :--- | :--- | :--- |
| `step1_one_call.ps1` | Nothing — one HTTP POST | A response is a *list of content blocks*, not a string |
| `step2_conversation.ps1` | An array you keep | "Memory" is that array, resent in full every turn |
| `step3_first_tool.ps1` | One tool, two round trips by hand | The model can't run anything; it asks, and your code answers |
| `step4_agent_loop.ps1` | `while` | That's the agent. Everything else is bookkeeping |

Step 3 is the one to read slowly. Step 4 adds no new idea at all — it wraps step 3 in a
loop, plus a tool registry, an error path, and a step cap.

## Things worth noticing

**Watch `input_tokens` climb in step 2.** Every turn resends the whole conversation, so turn
ten pays for turns one through nine. That is not a detail; it's the cost model. Three short
turns, measured:

| turn | input tokens | output tokens |
| ---: | -----------: | ------------: |
| 1 | 27 | 40 |
| 2 | 74 | 34 |
| 3 | 119 | 28 |

Output stays flat. Input climbs, because it carries everything said so far.

**Tool results go back as a `user` message.** The model speaks, your program answers as the
user. Counter-intuitive until you've seen it, then obvious.

**A tool that fails still owes a result.** `step4` returns the error as a `tool_result` with
`is_error`, rather than crashing — the model reads it and corrects itself on the next turn.
It's the single biggest robustness win in the script.

**Several tool calls can arrive in one response.** Run them all and return every result in a
single user message. Splitting them across messages works, and gradually teaches the model
to stop asking in parallel.

**`Resolve-SafePath` in step 4 is not decoration.** The model chooses the path argument, so
a prompt-injected file could ask it for something well outside the working directory.
Sandboxing is the script's job, not the model's.

## PowerShell-specific traps

- **`Invoke-WebRequest`, not `Invoke-RestMethod`.** The API sends no `charset` in its
  content type, so PowerShell 5.1 decodes the response as ISO-8859-1 and every degree sign,
  em dash and accent comes back as mojibake — `18°C` arrives as `18Â°C`. Decoding
  `RawContentStream` as UTF-8 yourself is the fix, and it costs one extra line.
- `ConvertTo-Json -Depth 100`. The default depth of 2 silently flattens a tool schema into
  a useless string.
- Send UTF-8 bytes, not the JSON string, or non-ASCII gets mangled on the way out too.
- Splatting needs a *variable* (`$arguments`), not an inline expression.
- `[Collections.Generic.List[object]]`, not an array — `+=` copies the whole thing each turn.
- `@(...)` around a single-element tool list, or it serialises as an object and the API
  rejects it.
- Windows PowerShell 5.1 negotiates TLS 1.0 by default; the API refuses it.

---

*Verified against the Claude API on 30 August 2026, running `claude-haiku-4-5`. Steps 1 and
3 were run as written; steps 2 and 4 are interactive, so their loops were driven
non-interactively with fixed input. Asked for a directory listing and a file, step 4's model
requested both tools in a single turn — the parallel case the loop is written to handle.*
