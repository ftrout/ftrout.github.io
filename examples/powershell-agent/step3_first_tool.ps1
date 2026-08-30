<#
Step 3 - One tool, one hand-cranked round trip. Read this one slowly.

A tool is not magic, and the model cannot execute anything. The mechanism is:

  1. You describe a function to the model as JSON (name, description, and a
     JSON Schema for its arguments).
  2. Instead of finishing, the model replies with a `tool_use` block:
     "please run get_weather with @{ location = 'Paris' }".
  3. YOUR code runs the real PowerShell function.
  4. You append a `tool_result` block and call the API again.
  5. The model reads the result and writes its answer.

That is all of it. Step 4 only wraps 2-5 in a while loop.

    .\step3_first_tool.ps1
#>

$ApiUrl = 'https://api.anthropic.com/v1/messages'
$Model  = 'claude-haiku-4-5'

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12


# --- 1. The real PowerShell function ---------------------------------------

function Get-Weather {
    param([string] $location)

    $fake = @{ paris = '18C, light rain'; tokyo = '27C, clear'; oslo = '4C, snow' }
    $key  = $location.ToLower()
    if ($fake.ContainsKey($key)) { return $fake[$key] }
    return "No data for $location."
}


# --- 2. How the model sees it ----------------------------------------------
# The descriptions are prompt text, not documentation. They are the only thing
# telling the model when to reach for this. Vague descriptions, bad agent.

$WeatherTool = @{
    name         = 'get_weather'
    description  = 'Get the current weather for a city. Use this whenever the user asks about weather; do not guess from memory.'
    input_schema = @{
        type       = 'object'
        properties = @{
            location = @{ type = 'string'; description = "City name, e.g. 'Paris'" }
        }
        required   = @('location')
    }
}


function Invoke-Claude {
    param([Parameter(Mandatory)] $Messages, $Tools)

    if (-not $env:ANTHROPIC_API_KEY) { throw 'Set ANTHROPIC_API_KEY first.' }

    $payload = @{
        model      = $Model
        max_tokens = 16000
        messages   = $Messages
    }
    if ($Tools) { $payload.tools = $Tools }

    # -Depth matters more here: a tool schema is four levels deep on its own,
    # and the default of 2 would flatten it into a useless string.
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
    # Tool arguments arrive as a PSCustomObject, but splatting needs a
    # hashtable. PowerShell 7 has -AsHashtable; 5.1 does not.
    param($Object)

    $hashtable = @{}
    if ($null -ne $Object) {
        foreach ($property in $Object.PSObject.Properties) {
            $hashtable[$property.Name] = $property.Value
        }
    }
    return $hashtable
}


# --- main ------------------------------------------------------------------

$messages = [Collections.Generic.List[object]]::new()
$messages.Add(@{ role = 'user'; content = "What's the weather in Paris right now?" })

# ---- Round trip 1: the model asks for the tool ----
$response = Invoke-Claude -Messages $messages -Tools @($WeatherTool)

"stop_reason: $($response.stop_reason)"
$response.content | ConvertTo-Json -Depth 100

if ($response.stop_reason -ne 'tool_use') { throw 'Model answered directly; nothing to demo.' }

# Echo the assistant turn back verbatim. The tool_use block has to survive
# intact - its id is what links your result to the request.
$messages.Add(@{ role = 'assistant'; content = @($response.content) })

# ---- Run the tool ourselves ----
$toolResults = [Collections.Generic.List[object]]::new()

foreach ($block in $response.content) {
    if ($block.type -ne 'tool_use') { continue }

    "`n>> running $($block.name) with $($block.input | ConvertTo-Json -Compress)"

    # Splatting needs a variable - @(...) would build an array instead.
    $arguments = ConvertTo-Hashtable $block.input
    $output = Get-Weather @arguments
    ">> got: $output"

    $toolResults.Add(@{
        type        = 'tool_result'
        tool_use_id = $block.id        # must match exactly
        content     = [string] $output # always a string
    })
}

# Results go back as a USER message. Counter-intuitive, but that is the
# protocol: the model speaks, your program answers as the user.
$messages.Add(@{ role = 'user'; content = @($toolResults) })

# ---- Round trip 2: the model reads the result and answers ----
$response = Invoke-Claude -Messages $messages -Tools @($WeatherTool)

"`nstop_reason: $($response.stop_reason)"     # -> end_turn
"`n$(($response.content | Where-Object { $_.type -eq 'text' }).text)"
