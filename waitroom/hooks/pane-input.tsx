// The pane's keyboard surface. A Client module: it draws a hint and posts the
// keys it is given to the mod, which replays them into the browser.
import type { ClientModule, ClientKeyEvent } from 'claude-code'

import { toAction } from './input-map'

type Props = { hint: string }

const PaneInput: ClientModule<Props> = (props, surface) => {
  const { Box, Text } = surface.elements
  surface.onKey((ev: ClientKeyEvent) => {
    const action = toAction(ev.key)
    if (action) surface.post(action)
  })
  return (
    <Box flexDirection="column">
      <Text dimColor>{props.hint}</Text>
    </Box>
  )
}

export default PaneInput
