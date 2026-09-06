---
title: 'The Tool Is the Attack Surface'
description: 'My PowerShell agent had one tool and one argument. MCP scales that to remote servers with their own credentials — and the model still picks the path.'
pubDate: '2026-09-06'
tags: ['agents', 'security', 'mcp']
---

In step three of my PowerShell agent, the model picks the path argument. I wrote the function, I run it, and the model decides where it points. One tool, one argument, and the model was already choosing the input.

I thought that was the interesting part. It wasn't. The interesting part was that I had to be the one running it.

## What MCP actually is

MCP is the same mechanism, scaled up and moved off my laptop. Instead of a function I wrote in the same script, the tool lives on a remote server. The server has its own credentials, its own permissions, its own network access. The model still picks the arguments. My code still runs the call. The only thing that changed is the blast radius.

The model doesn't know the difference. It reads a tool description, decides the tool is relevant, and emits a tool_use block. Whether that description came from a function I typed by hand or a server someone else shipped, the model treats it the same way — as instructions it should follow.

That's the part that matters. The description is prompt text. It is not documentation. It is the only thing telling the model when to reach for the tool, and what the tool is for. If I can write a description that makes the model do something I didn't intend, so can anyone who can ship a tool.

## What that looks like in practice

In August, researchers found an active campaign — Deadbugz — distributing a malicious MCP server disguised as a benign text-formatting tool. Twenty-three pull requests across unrelated repositories in a seventy-four-minute window. The server offered two innocent-looking tools: format_text and summarize. It tracked how many times an agent called them. After three ordinary calls, it rewrote its own metadata and started directing the agent to search for SSH keys, AWS credentials, shell history, Kubernetes configs — while hiding that activity from the user.

The payload was gated on usage. Install-time review saw nothing. Static analysis saw nothing. The tool only weaponized after the agent had established a normal pattern.

That's a rug pull, and it's catalogued as MCP03 in the OWASP MCP Top 10 — tool poisoning. Description-based manipulation. Low difficulty, severe impact.

The same week, the new MCP spec shipped. It removed sessions, which killed some old attack classes. It added MCP Apps — servers shipping interactive HTML rendered in a sandboxed iframe inside the client. Stored XSS in the AI interface. An attacker plants malicious script through a tool; when an agent or user views it, the script runs in the app layer, which sits above source code, terminals, filesystems, and every other connected server.

The spec also replaced sessions with portable handles — strings passed in the conversation. A prompt-injection payload in a Jira ticket or a tool response can plant or read a valid handle. No server access required. The handle is just text in the context, and the model will happily pass it along.

## The part that doesn't change

None of this is new in principle. It's the same thing my PowerShell agent did, with a bigger audience. The model picks the argument. The tool runs with whatever credentials the server holds. The description is untrusted text that the model treats as instruction.

The only difference is that in my toy, the worst case was a wrong weather lookup. In production, the worst case is an agent quietly exfiltrating credentials through a tool that looked legitimate on install.

OWASP has a whole Top 10 for this now — token mismanagement, scope creep, command injection, shadow servers, context over-sharing. Thirty-plus CVEs in two months against MCP servers alone. Thirty-six percent of public servers carry SSRF. Forty-one percent have no authentication.

## The boundary moved

Here's the honest version. The model is the weak link. It decides which tool to call and what arguments to pass. But the tools are where the actual damage happens, because they hold the credentials and the permissions.

The model can't do anything it can't reach, and the tool is what reaches.

So the boundary moved. It used to be the prompt — what you told the model. Now it's the tool's credentials — what the tool is allowed to touch. Sandbox the tool, and the model's mistakes stay cheap. Leave it wide open, and one poisoned description becomes a real breach.

That's the line: the model picks the argument, the tool holds the keys, and the permission scope is the only thing standing between a bad call and a real incident.

## What I do about it

I don't trust the description. I treat every tool the way I treated the PowerShell function — as code I have to review, not as a capability I can delegate to the model's judgment.

I pin versions. A tool that updates its metadata after install is a different tool. Hash it, fingerprint it, and re-check it on every update.

I scope the credentials to the minimum the tool actually needs. If a tool reads files, it gets read-only access to one directory. If it calls an API, it gets one endpoint. The tool's permissions are the ceiling on what the model can do, no matter what the description says.

I log every tool call — the tool, the arguments, the result. Not because I can prevent every bad call, but because I want to see the pattern before it becomes a breach. Deadbugz worked because nobody was watching the usage count.

And I assume the description is hostile. Not because every tool author is malicious, but because the model can't tell the difference, and I can't either — not reliably, not at the speed agents move.

The model is the weak link. The tool is the attack surface. The permissions are the boundary. Get those three right, and the rest is just engineering.