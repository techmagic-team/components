import matchVariable from './matchVariable'

describe('#matchVariable()', () => {
  it('should exact match variable with only one word', () => {
    expect(matchVariable('${abc}')).toEqual({
      expression: 'abc',
      exact: true,
      match: '${abc}',
      preferredValue: 'abc',
      defaultValue: null
    })
  })

  it('should return null for non match', () => {
    expect(matchVariable('abc')).toEqual({
      expression: undefined,
      exact: undefined,
      match: undefined,
      preferredValue: undefined,
      defaultValue: undefined
    })
  })

  it('should match variable with surounding text', () => {
    expect(matchVariable('hello ${abc} dude')).toEqual({
      expression: 'abc',
      exact: false,
      match: '${abc}',
      preferredValue: 'abc',
      defaultValue: null
    })
  })

  describe('when using OR (||)', () => {
    it('should exact match variable with only one word', () => {
      expect(matchVariable("${abc || 'world'}")).toEqual({
        expression: "abc || 'world'",
        exact: true,
        match: "${abc || 'world'}",
        preferredValue: 'abc',
        defaultValue: 'world'
      })
    })

    it('should match variable whith surrounding text', () => {
      expect(matchVariable("hello ${abc || 'world'}")).toEqual({
        expression: "abc || 'world'",
        exact: false,
        match: "${abc || 'world'}",
        preferredValue: 'abc',
        defaultValue: 'world'
      })
    })
  })
})
