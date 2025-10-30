export function scoreIq(intelligenceIndex?: number): 0 | 1 | 2 | 3 | 4 | 5 {
  if (!intelligenceIndex)
    return 0

  if (intelligenceIndex >= 65)
    return 5
  if (intelligenceIndex >= 55)
    return 4
  if (intelligenceIndex >= 45)
    return 3
  if (intelligenceIndex >= 35)
    return 2
  if (intelligenceIndex >= 25)
    return 1

  return 0
}

export function scoreSpeed(tokensPerSec?: number): 0 | 1 | 2 | 3 | 4 | 5 {
  if (!tokensPerSec)
    return 0

  if (tokensPerSec >= 300)
    return 5
  if (tokensPerSec >= 200)
    return 4
  if (tokensPerSec >= 100)
    return 3
  if (tokensPerSec >= 50)
    return 2
  if (tokensPerSec >= 25)
    return 1

  return 0
}
