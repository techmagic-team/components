import path from 'path'
import { deserialize, resolveComponentEvaluables, serialize } from '../../../src/utils'
import { createTestContext } from '../../../test'

beforeEach(() => {
  jest.clearAllMocks()
})

afterAll(() => {
  jest.restoreAllMocks()
})

describe('Component', () => {
  const cwd = path.resolve(__dirname, '..')
  let context
  let Component

  beforeEach(async () => {
    context = await createTestContext({ cwd })
    Component = await context.import('./')
  })

  describe('#define()', () => {
    it('should return components as children when calling define', async () => {
      const component = await context.construct(Component, {})

      component.components = {
        myComponent: {
          type: './',
          inputs: {}
        }
      }

      const children = await component.define()

      expect(children).toEqual(component.components)
    })

    it('should support child components defined at different properties', async () => {
      const component = await context.construct(Component, {})

      component.component1 = {
        type: './',
        inputs: {}
      }

      component.objectProp = {
        component2: {
          type: './',
          inputs: {}
        },
        component3: {
          type: './',
          inputs: {}
        }
      }

      component.arrayProp = [
        { component4: { type: './', inputs: {} } },
        { component5: { type: './', inputs: {} } }
      ]

      const children = await component.define()

      expect(children.component1).toEqual(component.component1)
      expect(children.objectProp).toEqual(component.objectProp)
      expect(children.arrayProp).toEqual(component.arrayProp)
    })
  })

  it('shouldDeploy should return deploy when prevInstance is null', async () => {
    const component = await context.construct(Component, {})

    expect(component.shouldDeploy(null, context)).toEqual('deploy')
  })

  it('shouldDeploy should return undefined when no changes have occurred in empty components', async () => {
    let component = await context.construct(Component, {})
    component = await context.defineComponent(component)
    component = resolveComponentEvaluables(component)
    await component.deploy(null, context)

    const prevComponent = await deserialize(serialize(component, context), context)

    let nextComponent = await context.construct(Component, {})
    nextComponent = await context.defineComponent(nextComponent, prevComponent)
    nextComponent = resolveComponentEvaluables(nextComponent)

    const result = nextComponent.shouldDeploy(prevComponent, context)

    expect(result).toBe(undefined)
  })

  it("shouldDeploy should return undefined when inputs don't change", async () => {
    let component = await context.construct(Component, {
      foo: {
        bar: 'value'
      }
    })
    component = await context.defineComponent(component)
    component = resolveComponentEvaluables(component)
    await component.deploy(null, context)

    const prevComponent = await deserialize(serialize(component, context), context)

    let nextComponent = await context.construct(Component, {
      foo: {
        bar: 'value'
      }
    })
    nextComponent = await context.defineComponent(nextComponent, prevComponent)
    nextComponent = resolveComponentEvaluables(nextComponent)

    const result = nextComponent.shouldDeploy(prevComponent, context)

    expect(result).toBe(undefined)
  })

  it('shouldDeploy should return "deploy" when inputs change', async () => {
    let component = await context.construct(Component, {
      foo: {
        bar: 'value'
      }
    })
    component = await context.defineComponent(component, null)
    component = resolveComponentEvaluables(component)
    await component.deploy(null, context)

    const prevComponent = await deserialize(serialize(component, context), context)

    let nextComponent = await context.construct(Component, {
      foo: {
        bar: 'new-value'
      }
    })
    nextComponent = await context.defineComponent(nextComponent, prevComponent)
    nextComponent = resolveComponentEvaluables(nextComponent)

    const result = nextComponent.shouldDeploy(prevComponent, context)

    expect(result).toBe('deploy')
  })

  it("shouldDeploy should return undefined when inputs with components don't change", async () => {
    let component = await context.construct(Component, {
      components: {
        foo: await context.construct(Component, {})
      }
    })
    component = await context.defineComponent(component)
    component = resolveComponentEvaluables(component)
    await component.deploy(null, context)

    const prevComponent = await deserialize(serialize(component, context), context)

    let nextComponent = await context.construct(Component, {
      components: {
        foo: await context.construct(Component, {})
      }
    })
    nextComponent = await context.defineComponent(nextComponent, prevComponent)
    nextComponent = resolveComponentEvaluables(nextComponent)

    const result = nextComponent.shouldDeploy(prevComponent, context)

    expect(result).toBe(undefined)
  })

  it('should generate an instanceId on construct', async () => {
    const component = await context.construct(Component, {})
    expect(typeof component.instanceId).toBe('string')
  })

  it('should preserve instanceId on hydrate', async () => {
    let component = await context.construct(Component, {})
    component = await context.defineComponent(component)
    component = resolveComponentEvaluables(component)
    await component.deploy(null, context)

    const prevComponent = await deserialize(serialize(component, context), context)

    const nextComponent = await context.construct(Component, {})
    nextComponent.hydrate(prevComponent, context)

    expect(nextComponent.instanceId).toBe(prevComponent.instanceId)
  })
})
