# v2 Architecture Overview

This document outlines the goals, target personas and the methods of how we arrived at the v2 framework architecture.


## Goals

- Give developers a tool that is SIMPLE and EASY to use to build and deploy their APPLICATIONS while doing so SAFELY.
- Build upon familiar concepts from v1, making v2 feel like an extension of where we were with v1 while greatly improving and expanding the framework's capabilities.
- Give developers a low level abstraction to introduce a way to deploy and manage any kind of cloud/SaaS resource (components)
- Give developers a SIMPLE way of composing together these low level building blocks into higher level abstractions
- Rid us of the baggage of CloudFormation and other technology weighing us down
- Give developers familiar concepts to work with so that the usage and development patterns of framework v2 can be easily and quickly understood (object oriented design patterns)
- Create an architecture that will be easier to maintain for us and the community, has flexibility and room for growth and does not have the same breaking change/versioning issues that v1 had.
- Do all of the above in a RELIABLE way.
  - The cost of having this tooling fail is significantly greater compared to a lot of other tools (dollars lost, careers damaged, users hurt, etc).
  - If the old version of the framework failed, it failed before anything had a chance to go wrong. CloudFormation acted as a safeguard because (though difficult to use) it is an incredibly RELIABLE tool and handled the heavy lifting of safely and reliably deploying an application.


## Personas

Who are the personas for framework v2?

#### Application developers (95%)
- These users use the framework to build and deploy their application (very similar, if not the same, as our v1 users)
- These users are not necessarily JS developers
- They will almost exclusively interact with serverless.yml and their function code (could be any number of languages)
- They should not require knowledge of Javascript to use the framework
- They will likely not interact with component code.

#### Component power users (1%)
- These users develop higher order components that are meant to be reusable by other developers.
- These are open source devs who like to build things that other people want to use.
- This is us (serverless.com).
- These users will interact with `serverless.yml` in a lot of cases to statically declare reusable components.
- These users will also interact with the `define` method when they need the flexibility
- Will likely not interact with deploy/remove unless implementing a low level resource component.

#### Resource providers (SaaS and Cloud) (4%)
- These users develop low level components (resources) that are reflections of their SaaS/cloud offerings for use by backend application developers and component power users.
- These users will almost exclusively interact with the `deploy`, `shouldDeploy` and `remove` methods of the component API.
- These users have the TOUGHEST job.
  - Writing a component that is RELIABLE is deceptive because it appears EASY but is actually DIFFICULT.
  - A component that is not RELIABLE can have catastrophic consequences and it only takes ONE for things to go wrong.
  - Repeating the above... it is EASY to make something with CATASTROPHIC consequences and it only takes ONE.


## Example target experience usages

This section provides examples of the users experience we are aiming to provide for each persona above.

### Example of target experience for application developers

This experience should be familiar and play strongly on our success with v1. We should maintain the familiar experience of defining a service, functions and connecting functions to events. Instead of resources, the user uses components to define the other parts of their infrastructure/application.

Using components as event sources, the user should be able to connect their functions to events that the components are the source of.

```yaml
name: ImageUploadService
extends: Service

providers:
  ...

compute:
  ...

functions:
  uploadImage:
    compute: ${self.compute}
    handler: index.uploadImage
    code: ./uploader
    env:
      bucket: ${this.components.bucket}
  resizeImage:
    compute: ${self.compute}
    handler: index.resizeImage
    code: ./resizer
    events:
      - source: ${this.components.bucket}
        config:
          event: s3:ObjectCreated:*

components:
  bucket:
    type: AwsS3Bucket
    inputs: ...
```


### Example of target experience for component power users

"That said, components must be super super super simple to use and compose and also be stable, otherwise this will not work." ~ Austen

Overall goal is to make writing a Serverless component as easy to write as a React component. 99% of users of React have no idea how it works under the hood. They know the APIs and they know how to write a component. We should strive for the same thing. Users should define their application in a similar way... by defining the child components and not caring about how the core manages the deployment of each, tracks state, resumes from where it left off, determines what has changed, ensures reliability, etc.

This offloads any concern of trying to get things like idempotency, recoverability or order right. It also ensures that the higher order components a user writes do not have issues that will break the application. This also isolates the concerns of trying to get these problems right to the thin layer of base level components.

NOTE: In a more mature ecosystem, the base level components (components that have no direct dependencies) will be significantly fewer in number compared to the number of components that make use of those base level ones.


There are two experiences for how users can define the child components of their component. Each of these only methods requires the developer to define what they want to exist and to do so once. These two methods should be extremely similar so that the user does not need to learn something new when they transition from writing components statically to writing them dynamically in code.

The first is to statically declare child components in `serverless.yml`

```yaml
name: GithubWebhookAws
extends: Component

inputTypes:
  function:
    type: Function
    required: true
  githubRepo:
    type: string
    required: true
  webhookTriggers:
    type: array
    required: true
    example:
      - create

components:
  githubWebhook:
    type: GithubWebhook
    inputs:
      payloadUrl: ${this.components.webhookEndpoint.baseUrl}/webhook
      events: ${inputs.webhookTriggers}
  webhookEndpoint:
    type: RestApi
    inputs:
      routes:
        /webhook: # routes begin with a slash
          post: # HTTP method names are used to attach handlers
            function: ${inputs.function}
            cors: true
```


The second is programmatically using the `define` method.

```js
const GithubWebhookAws = {
  define() {
    return {
      ...this.components,
      githubWebhook: {
        type: 'GithubWebhook',
        inputs: {
          payloadUrl: '${this.components.webhookEndpoint.baseUrl}/webhook',
          events: this.inputs.webhookTriggers
        }
      },
      webhookEndpoint: {
        type: 'RestApi',
        inputs: {
          routes: {
            '/webhook': {
              post: {
                function: this.inputs.function
                cors: true
              }
            }
          }
        }
      }
    }
  }
}
```


### Example of target experience for resource providers

This experience SHOULD be straightforward. It should address the heavy lifting of a the nits of a specific API but should only need to address one SDK call at a time.

However, at the moment, it is very easy to get this implementation wrong. The happy path is easy to get right but it is not very obvious what can go wrong and the various states that the component needs to recover from.

It would be nice if the experience for developing a low level resource component was as easy as this...
```js
import { createBucket, deleteBucket } from './utils'

const createBucket = async ({ bucketName, provider }) => {
  const SDK = provider.getSdk()
  const s3 = new SDK.S3()
  return s3.createBucket({ Bucket: bucketName }).promise()
}

const deleteBucket = async ({ bucketName, provider }) => {
  const SDK = provider.getSdk()
  const s3 = new SDK.S3()
  const res = await s3.listObjectsV2({ Bucket: bucketName }).promise()

  // Objects in bucket prevent it from being able to be removed. Delete all objects first.
  const objectsInBucket = []
  if (res) {
    res.Contents.forEach((object) => {
      objectsInBucket.push({
        Key: object.Key
      })
    })
  }

  if (objectsInBucket.length) {
    await s3
      .deleteObjects({
        Bucket: bucketName,
        Delete: {
          Objects: objectsInBucket
        }
      })
      .promise()
  }

  return s3.deleteBucket({ Bucket: bucketName }).promise()
}

const AwsS3Bucket = {
  shouldDeploy(prevInstance) {
    if (!prevInstance) {
      return 'deploy'
    }

    if (prevInstance.bucketName !== this.bucketName) {
      return 'replace'
    }
  }

  async deploy(prevInstance, context) {
    await createBucket(this)
  }

  async remove(context) {
    await deleteBucket(this)
  }
}
```

Can you spot the problems with the above implementation?

1. Trying to delete a bucket when it's already been deleted throws an error that ends the deployment
- this can happen if a user goes in an manually deletes the bucket from the AWS console. Our state still thinks the resource exists, even though it doesn't.

2. Trying to create a bucket with a name that already exists throws an error that ends the deployment
- This can happen if the deployment is interrupted after the SDK call to create the bucket has been made but before AWS has returned us a successful response.
- An interruption can happen when...
  - A user uses ctrl-c to end the program
  - The internet fails
  - An out of memory error occurs
  - The machine performing the deployment loses power.
- All of the above scenarios will result in the bucket existing on AWS but our state telling us that it does not exist.

3. Trying to deploy a bucket that was previously successfully deployed but then subsequently deleted manually will never be deployed
- This happens because our state still thinks that the bucket exists, even though it doesn't. so when we perform our comparison of the current instance vs the previous one, everything looks fine.

4. Changing a bucket's name results in the loss of all objects on the bucket
- Changing a bucket's name will result in a replacement of the bucket. However, this code deletes all objects from the previous bucket in order to be able to remove the old bucket. What it should do is copy the objects from the previous bucket to the new one before deleting the old bucket.


#### The idempotency problem
- two not obvious problems that end users of the component WILL eventually run into that make idempotency important
  - during the middle of an API call to a provider the program is interrupted.
    - this results in an error within the framework and state is not saved (we don't know if it was successful, we assume not)
    - the resource was still created on the provider
  - the user deletes a resource using a console
    - we then try to delete the same resource again later which causes an error
    - or, we run deploy again but the resource is not recreated because it thinks it already exists
- idempotency allows us to recover from these states, but it's not nearly as obvious to write this code in an idempotent way.
  - Our entire team has gotten it wrong on almost every component.
  - all external contributors have gotten it wrong.
  - smart people from places like Google and Cloudflare have gotten it wrong.

#### What we can do to address this issue?
SHORT TERM
- provide a set of pre-defined integration tests that are run against ALL components to ensure they meet these requirements before we deploy them
- isolate the issues of idempotency to the thin layer of resource level components (fewer to deal with)

LONG TERM
- automatically generate the resource level components based on API meta data.
  - Similar to how AWS auto generates their SDKs based on the meta data of their APIs.
    - checkout their metadata sections if you don't believe me https://github.com/aws/aws-sdk-js/blob/master/apis/cloudfront-2016-11-25.normal.json


## The component API

Built on the back of an object oriented (OO) type system. The aim here was to make writing components feel just as familiar as writing classes and to drastically reduce the learning curve by building on familiar concepts.

What problems did the type system solve?
- supporting other concepts like App, Service, Function, Compute, and Provider
  - These implementations needed support for additional properties instead of just the built in `components` property (properties from classes)
- exposing component methods to other components so that they can be used to allow components to interact and modify one another (used by compute, RestApi, Cron) (methods from classes)
- fundamental to our migration plan for v1 (being able to interpret any yaml regardless of the shape v1, v2, anything else)
- enabled reuse of functionality without requiring the user to write javascript
- gave developers a way of writing their own abstractions
  - we introduced new abstractions in the form of compute, provider, subscriptions, etc
- creating consistency between how developers think about the javascript code and how they think about the yml (moving from one to another should be simple and feel familiar)


### construct(inputs, context)

* This method is OPTIONAL

Similar to a class constructor, this method can be used to assign properties to your component instance. You can also define any data for you instance as well like default values or instantiation of more complex data types.

```js
const AwsIamRole = async (SuperClass) => {
  ...
  return class extends SuperClass {
    construct(inputs, context) {
      super.construct(inputs, context)
      const defaultPolicy = {
        arn: 'arn:aws:iam::aws:policy/AdministratorAccess'
      }
      this.policy = inputs.policy || defaultPolicy
      this.roleName = inputs.roleName || `role-${this.instanceId}`
    }
  }
  ...
}
```

Why is `construct` needed?
- construct gave us a method to do what is not yet possible in variables (defaults, more complicated logic where a value needs loading or manipulation before assignment)
- This is the equivalent of a constructor in a class

Things we can do to improve
- reduce the need to write this method by making it possible to do most of this in sls.yml
- remove async support
- do not require user to manually resolve variables if they need to perform computation against them



<br /><br />
## define(context)

* This method is OPTIONAL

This method can be used to programmatically define your component's children. Using this method you will construct any child components that this component would like to create as part of this component and return them to core. Once the components are returned to core, it will take over the responsibility of creating, updating and removing the each of the component children.

To define a component, simply construct any number of components and return them in either an object or an array.


```js
import { resolve } from '@serverless/utils'

const AwsLambdaFunction = {
  ...
  async define(context) {
    if (!this.inputs.role) {
      return {
        role: {
          type: 'AwsIamRole',
          inputs: {
            roleName: '${this.functionName}-execution-role',
            service: 'lambda.amazonaws.com',
            provider: this.inputs.provider
          }
        }
      }
    }
  }
  ...
}
```

Why is `define` needed?
- provide a programmatic way for defining the component children (instead of statically)
  - used by Function to define different child components based on the compute it received
  - Used by RestApi to dynamically define the the AwsApiGateway (or other gateways) based on the routes it received
  - Used by Cron to dynamically define the components necessary for attaching cron to a function
  - Used by AwsLambdaFunction to optionally deploy a default role when none is provided in `inputs`
- Gives developers one method to declare what they want to be deployed (one method instead of two)
- Allows us to know what will change before we change anything
  - This is needed in order to make deployments predictable
  - Needed in order to have a plan command
- Allow developers to build new abstractions.
  - compute and subscriptions as examples
- Removes the concern of having to write idempotent, stateful, recoverable code from higher level components
  - isolates the concerns of idempotency to the lowest level parts

Things we can do to improve
- make the way that child components are defined the exact same as it is in `sls.yml`.
  - This eliminates the need of having to load types to use them.
  - This makes it a lot more familiar given users will likely started in sls.yml and then eventually move to programmatic (if ever)

<br /><br />
## hydrate(previousInstance, context)

* This method was a stop gap for hydrating state and will be removed


<br /><br />
## shouldDeploy(prevInstance, context)

* This method is OPTIONAL
* This method optionally can be `async`.

This method is used to perform comparisons against the previous instance from state and indicate to the core whether your component should be deployed, replaced, removed or have no action taken against it.


*Note:* replacements are performed in the order of first creating all new infrastructure for all components that are being both deployed and replaced and then finally removing all the old infrastructure.


```js
import { resolve } from '@serverless/utils'

const AwsS3Bucket = (SuperClass) =>
  class extends SuperClass {
    ...
    shouldDeploy(prevInstance) {
      if (!prevInstance) {
        return 'deploy'
      }

      if (prevInstance.bucketName !== resolve(this.bucketName)) {
        return 'replace'
      }
    }
    ...
  }
}
```

Why is `shouldDeploy` needed?
- So that we can perform replacement of chains of components that depend upon one another
  - a number of cloud resources cannot be removed when they have other resources that depend upon them
  - It is impossible for a component to know what all depends upon it without basically reimplementing all of what core does and giving it knowledge of the entire application tree.
- Gives us a way to know what changes will be made before they are actually made.

Things we can do to improve
- allow shouldDeploy to contain all the diffing logic you will ever need to write.


## deploy(prevInstance, context)

* This method is OPTIONAL

If your component is responsible for a specific resource, make the sdk calls to deploy the resource now.

*Tip* You should try to focus each component on deploying only one resource. If your component is built from multiple resources, use the `define` method to construct them and return them to core. This way core will handle the heavy lifting of preserving their state, ordering their deployment amongst the other components, resolving their values and ensuring that deployments are properly resumed in the event that a deployment is disrupted. THIS LAST PART IS HARDER THAN IT SOUNDS.


```js
const AwsS3Bucket = (SuperClass) =>
  class extends SuperClass {
    ...
    async deploy(prevInstance, context) {
      await createBucket(this)
    }
    ...
  }
}
```


## remove(context)

* This method is OPTIONAL

If your component is responsible for a specific resource, make the sdk calls to remove the resource now.

```js
const AwsS3Bucket = (SuperClass) =>
  class extends SuperClass {
    ...
    async remove(context) {
      await deleteBucket(this)
    }
    ...
  }
}
```



## Next steps to get to the above experience

Fixing the experience for application developers
- better output
  - consistent progress logging
  - more useful results from info
  - better styling
  - colors
  - make component logging hidden by default
- figure out an implementation for config (env, command line args, programmatic, etc)
- prevent users from having to pass provider in everywhere
  - default providers in context (context passing)
- make sure all component names are consistent (AwsDynamoDB should be AwsDynamoDb)
- ensure deploy and remove can recover from deployments that error out
- ensure that components declared anywhere in yaml are deployed
  - improve base level define method to scan for any components in all properties

Fixing the experience for component power users
- remove hydrate method
- reduce the need for the use of the construct method
  - re-enable support for type/default support on properties and inputs
  - add support for variable logical or statement (x || y)
- remove async support in construct
- change how our define method works so that it is consistent with the usage in `sls.yml`
- ease use of variables
  - auto resolve variable constants
  - detect and warn when a variable has been used in a way that it may not be ready
  - use operator overloading so that variable resolution is done automatically for the user
  - ensure values used in variables are assigned before component is constructed (use a DAG for interpreting properties)

Fixing the experience for resource providers
SHORT TERM
- set of tests that check for idempotency and other common problems that are run against all components written in
- isolate the issues of idempotency to the thin layer of resource level components (fewer to deal with)

LONG TERM
- automatically generate the resource level components based on API meta data.
  - Similar to how AWS auto generates their SDKs based on the meta data of their APIs.
    - checkout their metadata sections if you don't believe me https://github.com/aws/aws-sdk-js/blob/master/apis/cloudfront-2016-11-25.normal.json


Additional improvements to help clarify things
- update all examples
- update primary readme
- complete write a component guide
- write a guide for composing components










## Q&A

why did we change state?
- we were already saving inputs, state and outputs which made diffing logic complicated.
- We aimed to simplify the experience to be just focussed on properties. This diffing became focussed on comparing your current instance which has the exact same shape as your previous instance.


why are App and Service a concept?

App
- I believe this could end up being used to configure and create a record for an "app" in our platform. This would enable a user to define an entire application and share that application in a reusable way that properly creates records in the platform.
- This concept could end up representing a top level component that itself is not composable (if this becomes a need).

Service
- One major point to adding this concept was to bring the familiar configuration of functions and events into v2. Our migration story becomes much simpler if there is a similar concept to migrate to from v1 to v2.
- we've barely scratched the surface here. A major issue when it comes to assembling services together that are meant to work with each other is establishing understood patterns between them. This could be the start to our application level opinion of how a service is defined.
