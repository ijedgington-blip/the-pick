import { calculateReturn } from '../../scripts/update-result'

describe('calculateReturn', () => {
  it('returns stake * odds on a win', () => {
    expect(calculateReturn('win', 2.5, 10)).toBe(25)
  })

  it('returns 0 on a loss', () => {
    expect(calculateReturn('loss', 2.5, 10)).toBe(0)
  })
})
