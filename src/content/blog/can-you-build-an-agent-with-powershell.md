---
title: "Can You Build an Agent With PowerShell?"
description: "Yes, in about eighty lines. An agent is a loop, a model call, some tools and a transcript. Here is each piece in PowerShell, plus the two bugs that cost me an afternoon."
pubDate: 2026-09-16
tags: [agents, security]
draft: false
---

The jump box does not have Python. It is not going to have Python. Getting
Python onto it means a change request, a review board that meets every other
Tuesday, and a software approval process that has defeated better people than
me.

It has PowerShell 5.1, because every Windows host does. It also has, already
configured, credentialed access to Active Directory, the Exchange management
tools, and the EDR vendor's module. Everything I would want an agent to reach
is one cmdlet away, on a machine where I cannot install anything.

So: can you build an agent in PowerShell? Yes. It took about eighty lines,
and most of the difficulty had nothing to do with the model.

## An agent is four things

The word does a lot of work it has not earned. When people say agent they
usually mean a system where the model decides what to do next, rather than
your code deciding. Strip the branding off and there are four parts:

1. **A model call.** One HTTP request. Text in, text out.
2. **Tools.** Functions you describe to the model, which it can ask you to run.
3. **A loop.** Call the model. If it asked for a tool, run it, hand back the
   result, call again. Stop when it stops asking.
4. **Memory.** The conversation so far, resent on every request, because the
   API is stateless.

That is the whole thing. The loop is a `while`. If that sounds anticlimactic,
good, because the interesting problems are everywhere else.

## Part one: the model call

There is no official Anthropic SDK for PowerShell, so this is raw HTTP against
the [Messages API](https://platform.claude.com/docs/en/api/messages). One
function, and it is the only place in the script that knows about the network.

```powershell
function Invoke-ClaudeMessage {
    param(
        [Parameter(Mandatory)][array]$Messages,
        [array]$Tools,
        [string]$System,
        [string]$Model     = 'claude-opus-5',
        [int]   $MaxTokens = 4096
    )

    $body = [ordered]@{
        model      = $Model
        max_tokens = $MaxTokens
        messages   = $Messages
    }
    if ($System) { $body.system = $System }
    if ($Tools)  { $body.tools  = $Tools }

    # Depth 20, not the default. See "What bit me" below.
    $json  = $body | ConvertTo-Json -Depth 20
    # Bytes, not a string. Also see below.
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)

    Invoke-RestMethod -Uri 'https://api.anthropic.com/v1/messages' -Method Post `
        -Headers @{
            'x-api-key'         = $env:ANTHROPIC_API_KEY
            'anthropic-version' = '2023-06-01'
        } `
        -ContentType 'application/json; charset=utf-8' `
        -Body $bytes
}
```

`Invoke-RestMethod` parses the JSON response into objects, so `$response.content`
is an array and `$response.stop_reason` is a string. That is genuinely nicer
than what you get in bash.

## Part two: tools

A tool is a name, a description, a JSON schema for its arguments, and something
to run. The model never runs anything. It returns a structured request and your
code decides what to do with it, which is the part worth remembering when you
are deciding what to expose.

I keep a registry so registering a tool and implementing it happen in one place.

```powershell
$script:Tools = @{}

function Register-AgentTool {
    param(
        [Parameter(Mandatory)][string]     $Name,
        [Parameter(Mandatory)][string]     $Description,
        [Parameter(Mandatory)][hashtable]  $InputSchema,
        [Parameter(Mandatory)][scriptblock]$Handler
    )
    $script:Tools[$Name] = @{
        Schema  = [ordered]@{
            name         = $Name
            description  = $Description
            input_schema = $InputSchema
        }
        Handler = $Handler
    }
}

function Get-ToolSchema { $script:Tools.Values | ForEach-Object { $_.Schema } }
```

Two read-only tools, both of which are one line because PowerShell already
knows how to do this:

```powershell
Register-AgentTool -Name 'get_failed_logons' `
    -Description 'Count failed logon events (4625) for a user in the last N hours.' `
    -InputSchema @{
        type       = 'object'
        properties = @{
            user  = @{ type = 'string';  description = 'sAMAccountName' }
            hours = @{ type = 'integer'; description = 'Lookback window, default 24' }
        }
        required   = @('user')
    } `
    -Handler {
        param($user, $hours = 24)
        Get-WinEvent -FilterHashtable @{
            LogName   = 'Security'
            Id        = 4625
            StartTime = (Get-Date).AddHours(-$hours)
        } -ErrorAction SilentlyContinue |
          Where-Object { $_.Properties[5].Value -eq $user } |
          Measure-Object | Select-Object -ExpandProperty Count
    }

Register-AgentTool -Name 'resolve_host' `
    -Description 'Resolve a hostname to IP addresses.' `
    -InputSchema @{
        type       = 'object'
        properties = @{ name = @{ type = 'string' } }
        required   = @('name')
    } `
    -Handler {
        param($name)
        (Resolve-DnsName -Name $name -ErrorAction Stop).IPAddress -join ', '
    }
```

Dispatch takes the model's arguments, which arrive as an object, and splats
them onto the handler as named parameters:

```powershell
function Invoke-AgentTool {
    param([string]$Name, $Arguments)   # not $Input: that is an automatic variable

    $tool = $script:Tools[$Name]
    if (-not $tool) { return "ERROR: unknown tool '$Name'" }

    $bound = @{}
    foreach ($p in $Arguments.PSObject.Properties) { $bound[$p.Name] = $p.Value }

    try   { (& $tool.Handler @bound | Out-String).Trim() }
    catch { "ERROR: $($_.Exception.Message)" }
}
```

The `try`/`catch` is load-bearing. When a tool throws, the loop must keep
going and the model must be told what happened, in words. A failed WinRM
connection is information the model can act on. An unhandled exception just
kills the run.

Splatting also means handler defaults work. If the model omits `hours`, the
handler's `$hours = 24` fills in, and I do not have to repeat the default in
the schema and in the code.

## Part three: the loop

```powershell
function Invoke-Agent {
    param([string]$Task, [int]$MaxTurns = 10)

    $messages = @(@{ role = 'user'; content = $Task })

    for ($turn = 1; $turn -le $MaxTurns; $turn++) {
        $response = Invoke-ClaudeMessage -Messages $messages `
                                         -Tools (Get-ToolSchema) `
                                         -System 'You are a SOC assistant. Investigate, do not speculate.'

        $messages += @{ role = 'assistant'; content = $response.content }

        if ($response.stop_reason -ne 'tool_use') {
            return ($response.content | Where-Object type -eq 'text' |
                    ForEach-Object text) -join "`n"
        }

        $results = @()
        foreach ($block in $response.content | Where-Object type -eq 'tool_use') {
            Write-Verbose "tool: $($block.name)"
            $results += [ordered]@{
                type        = 'tool_result'
                tool_use_id = $block.id
                content     = Invoke-AgentTool -Name $block.name -Arguments $block.input
            }
        }
        $messages += @{ role = 'user'; content = $results }
    }

    "Stopped: hit the $MaxTurns turn limit."
}
```

Three details that matter more than they look.

The whole `$response.content` array goes back into the transcript, not just the
text. The `tool_use` blocks have to be there or the API cannot match your
results to its requests.

Every `tool_result` must carry the `tool_use_id` it answers, and they all go in
a single user message. The model can ask for several tools at once, and the
`foreach` handles that, which is why results accumulate into one array instead
of being sent one at a time. The
[tool use documentation](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview)
covers the shape in full.

`$MaxTurns` is not optional. A loop with no ceiling, holding credentials, on a
box you cannot easily get to, is a bad afternoon waiting to happen.

## Part four: memory

There is nothing to build. `$messages` is the memory, and the API is stateless,
so the whole array goes up on every request. That has two consequences worth
internalising.

Cost grows with the square of the conversation, roughly, because every turn
resends everything before it. A ten-turn investigation is not ten calls worth
of input tokens, it is closer to fifty.

The context window, which is the amount of text the model can consider at once,
is finite. Dump a raw event log into a tool result and you will find the edge of
it quickly. My tools return counts and summaries, not raw records, for that
reason as much as any other.

Persisting a session is `ConvertTo-Json`, and resuming one is the reverse:

```powershell
$messages | ConvertTo-Json -Depth 20 | Set-Content ".\session-$(Get-Date -f yyyyMMdd-HHmmss).json"
$messages = Get-Content .\session-20260916-1432.json -Raw | ConvertFrom-Json
```

## What bit me

Two bugs, both PowerShell rather than Claude, both silent.

**`ConvertTo-Json` truncates at depth 2 by default.** Not an error. It replaces
anything deeper with the literal string `System.Collections.Hashtable`. A tool
schema is four levels deep, so my entire `tools` array was being sent as that
string, and the model politely told me it had no tools. Every `ConvertTo-Json`
in the script carries `-Depth 20`.

**PowerShell 5.1 mangles non-ASCII in a string body.** I sent a 30-byte UTF-8
payload and the server received 25 bytes: `café` arrived as `caf?`, and an em
dash came through as a hyphen. Encoding the JSON to a UTF-8 byte array first
and passing the bytes fixes it exactly, 30 for 30. This is not academic. The
things I most want a model to read, phishing bodies, display names,
internationalised domains, are precisely the things that are not ASCII, and
the corruption happens before the model ever sees them.

Three smaller ones. `$Input` and `$args` are automatic variables, so do not
name parameters after them, which I did, and which produced behaviour I spent
a while blaming on the model. `Invoke-RestMethod` in 5.1 has no
`-SkipHttpErrorCheck`, so a rate limit response throws rather than returning,
and your retry logic goes in a `catch`. And `[Net.ServicePointManager]::SecurityProtocol`
reads `SystemDefault` on 5.1 rather than naming TLS 1.2, so pinning it
explicitly is a cheap line to include on older builds.

## Should you

For a locked-down Windows host where PowerShell is what you have, yes. It
works, it is about eighty lines, and you can read all of it in one sitting,
which is more than I can say for some agent frameworks.

For anything with a service level attached, no. You are hand-rolling what an
SDK gives you: retries with backoff, streaming, token accounting, structured
outputs, connection pooling. None of that is hard, and all of it is work you
will do badly the first time, as the two bugs above demonstrate.

The honest framing is that this is a deployment constraint, not an
architecture. And the same question from
[the last post](/blog/agents-arent-always-the-answer/) still applies before
any of it: if you can write down the steps before you see the input, you do
not want an agent at all. You want a script that calls the model twice. The
fact that you *can* build a loop in PowerShell is not an argument that you
should.

Where I have actually kept one is the case that earns it: an analyst on a
segmented network, asking open-ended questions of a host they cannot reach
from anywhere else.
