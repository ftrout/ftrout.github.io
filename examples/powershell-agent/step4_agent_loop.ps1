<#
Step 4 - The agent loop. This is a real agent.

The only new idea versus step 3 is `while`. Everything else is bookkeeping: a
tool registry so you are not writing a giant switch, an error path so one bad
call does not kill the run, and a step cap so a confused model cannot spin.

    while ($true) {
        $response = Invoke-Claude ...
        if ($response.stop_reason -ne 'tool_use') { break }   # done
        run every tool_use block, append every tool_result
    }

    .\step4_agent_loop.ps1        (type quit to exit)
    try: "what files are here, and what's in the README?"
#>

$ApiUrl    = 'https://api.anthropic.com/v1/messages'
$Model     = 'claude-haiku-4-5'
$MaxSteps  = 15                      # hard stop; a looping agent is a runaway bill
$Workspace = (Get-Location).Path

$SystemPrompt = 'You are a small command-line agent. You can inspect files in the ' +
                "user's working directory using your tools. Prefer using a tool over " +
                'guessing. When you have the answer, state it plainly.'

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12


# --- Tools: real functions, and the JSON the model sees ---------------------

function Resolve-SafePath {
    # The model chooses these arguments, and a prompt-injected file could ask
    # it for '..\..\.ssh\id_rsa'. Sandboxing is your job, not the model's.
    # GetFullPath normalises '..' without requiring the target to exist.
    param([string] $Path)

    $resolved = [IO.Path]::GetFullPath((Join-Path $Workspace $Path))
    if ($resolved -ne $Workspace -and
        -not $resolved.StartsWith($Workspace + [IO.Path]::DirectorySeparatorChar)) {
        throw "Refused: $Path is outside the workspace."
    }
    return $resolved
}


function Get-FileList {
    param([string] $path = '.')

    $names = Get-ChildItem -LiteralPath (Resolve-SafePath $path) -Name
    if (-not $names) { return '(empty directory)' }
    # Join into ONE string. Tool results must be a string, and cmdlets hand
    # you arrays constantly - an easy bug to introduce.
    return ($names -join "`n")
}


function Get-FileText {
    param([string] $path)

    $text = Get-Content -LiteralPath (Resolve-SafePath $path) -Raw -ErrorAction Stop
    if ($null -eq $text) { return '(empty file)' }
    # Cap it: tool output lands in the context window and you pay for it.
    if ($text.Length -gt 20000) { return $text.Substring(0, 20000) }
    return $text
}


# tool name (as the model sees it) -> command to run + schema to send
$Tools = @{
    'list_files' = @{
        Command = 'Get-FileList'
        Schema  = @{
            name         = 'list_files'
            description  = 'List file and directory names at a path inside the working directory. Defaults to the directory itself.'
            input_schema = @{
                type       = 'object'
                properties = @{ path = @{ type = 'string'; description = 'Relative path' } }
                required   = @()
            }
        }
    }
    'read_file' = @{
        Command = 'Get-FileText'
        Schema  = @{
            name         = 'read_file'
            description  = 'Read the text contents of a file inside the working directory.'
            input_schema = @{
                type       = 'object'
                properties = @{ path = @{ type = 'string'; description = 'Relative path' } }
                required   = @('path')
            }
        }
    }
}

# @(...) forces an array even with one tool - a bare .Values with a single
# entry serialises as an object, and the API needs a list.
$ToolSchemas = @($Tools.Values | ForEach-Object { $_.Schema })


# --- Transport -------------------------------------------------------------

function Invoke-Claude {
    param([Parameter(Mandatory)] $Messages)

    if (-not $env:ANTHROPIC_API_KEY) { throw 'Set ANTHROPIC_API_KEY first.' }

    $payload = @{
        model      = $Model
        max_tokens = 16000
        system     = $SystemPrompt
        messages   = $Messages
        tools      = $ToolSchemas
    }

    $body = [Text.Encoding]::UTF8.GetBytes(($payload | ConvertTo-Json -Depth 100))

    $headers = @{
        'x-api-key'         = $env:ANTHROPIC_API_KEY
        'anthropic-version' = '2023-06-01'
    }

    try {
        # Not Invoke-RestMethod: the API sends no charset in its content type, and
        # PowerShell 5.1 then decodes the body as ISO-8859-1 - turning every degree
        # sign, em dash and accent into mojibake. Decode the bytes ourselves.
        $raw = Invoke-WebRequest -Uri $ApiUrl -Method Post -Body $body -Headers $headers -ContentType 'application/json' -UseBasicParsing
        [Text.Encoding]::UTF8.GetString($raw.RawContentStream.ToArray()) | ConvertFrom-Json
    }
    catch {
        $detail = $_.ErrorDetails.Message
        if (-not $detail) { $detail = $_.Exception.Message }
        throw "API error: $detail"
    }
}


function ConvertTo-Hashtable {
    # PowerShell 7 has ConvertFrom-Json -AsHashtable; 5.1 does not.
    param($Object)

    $hashtable = @{}
    if ($null -ne $Object) {
        foreach ($property in $Object.PSObject.Properties) {
            $hashtable[$property.Name] = $property.Value
        }
    }
    return $hashtable
}


function Invoke-Tool {
    # Execute one tool_use block and return its tool_result block.
    param($Block)

    $result = @{ type = 'tool_result'; tool_use_id = $Block.id }
    $entry  = $Tools[$Block.name]

    if (-not $entry) {
        # Hand the mistake back rather than crashing; the model corrects itself
        # on the next turn. Biggest robustness win in the whole script.
        $result.content  = "Error: no tool named $($Block.name)."
        $result.is_error = $true
        return $result
    }

    try {
        $arguments = ConvertTo-Hashtable $Block.input
        $output = & $entry.Command @arguments
        $result.content = ($output | Out-String).TrimEnd()
    }
    catch {
        $result.content  = "Error: $($_.Exception.Message)"
        $result.is_error = $true
    }
    return $result
}


# --- The loop --------------------------------------------------------------

function Invoke-Agent {
    # $Messages is a List, so it is mutated in place and needs no return.
    param([Parameter(Mandatory)] $Messages)

    for ($step = 0; $step -lt $MaxSteps; $step++) {
        $response = Invoke-Claude -Messages $Messages

        # Branch on stop_reason BEFORE reading content. On a refusal, content
        # may be empty - anything indexing content[0] blows up here.
        if ($response.stop_reason -eq 'refusal') {
            'claude> (request declined)'
            return
        }

        $Messages.Add(@{ role = 'assistant'; content = @($response.content) })

        foreach ($block in $response.content) {
            if ($block.type -eq 'text') { "`nclaude> $($block.text)" }
        }

        if ($response.stop_reason -ne 'tool_use') {
            return    # end_turn or max_tokens - the model is finished
        }

        # One response can carry SEVERAL tool_use blocks. Run them all and
        # return every result in ONE user message; splitting them across
        # messages teaches the model to stop asking in parallel.
        $toolResults = [Collections.Generic.List[object]]::new()
        foreach ($block in $response.content) {
            if ($block.type -ne 'tool_use') { continue }
            "  [tool] $($block.name)($($block.input | ConvertTo-Json -Compress))"
            $toolResults.Add((Invoke-Tool $block))
        }

        $Messages.Add(@{ role = 'user'; content = @($toolResults) })
    }

    "`n(stopped after $MaxSteps steps)"
}


# --- main ------------------------------------------------------------------

"workspace: $Workspace"
'Type quit to exit.'

$conversation = [Collections.Generic.List[object]]::new()

while ($true) {
    $userInput = (Read-Host "`nyou").Trim()
    if ($userInput -in 'quit', 'exit') { break }
    if (-not $userInput) { continue }

    $conversation.Add(@{ role = 'user'; content = $userInput })
    Invoke-Agent -Messages $conversation
}
