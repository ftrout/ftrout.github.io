<#
Step 2 - A conversation. Still no tools, still no agent.

The only new idea is that you keep the messages array and resend all of it
every turn. That array is the entire memory mechanism - nothing is stored
anywhere else, and the model recalls nothing on its own.

Watch input_tokens climb with every exchange. That is the whole conversation
being resent, and it is why long agent runs cost what they do.

    .\step2_conversation.ps1        (type quit to exit)
#>

$ApiUrl = 'https://api.anthropic.com/v1/messages'
$Model  = 'claude-haiku-4-5'

$SystemPrompt = 'You are a concise assistant. Answer in at most three sentences.'

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12


function Invoke-Claude {
    param([Parameter(Mandatory)] $Messages)

    if (-not $env:ANTHROPIC_API_KEY) { throw 'Set ANTHROPIC_API_KEY first.' }

    $payload = @{
        model      = $Model
        max_tokens = 16000
        system     = $SystemPrompt
        messages   = $Messages
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


function Get-ResponseText {
    param($Response)
    ($Response.content | Where-Object { $_.type -eq 'text' } | ForEach-Object { $_.text }) -join "`n"
}


# --- main ------------------------------------------------------------------

# A List, not an array: += on an array copies the whole thing every turn.
$messages = [Collections.Generic.List[object]]::new()

'Type quit to exit.'

while ($true) {
    $userInput = (Read-Host "`nyou").Trim()
    if ($userInput -in 'quit', 'exit') { break }
    if (-not $userInput) { continue }

    $messages.Add(@{ role = 'user'; content = $userInput })

    $response = Invoke-Claude -Messages $messages

    # Append the assistant turn verbatim. This line is the memory feature.
    $messages.Add(@{ role = 'assistant'; content = @($response.content) })

    "`nclaude> $(Get-ResponseText $response)"
    "        [in $($response.usage.input_tokens) / out $($response.usage.output_tokens) tokens]"
}
