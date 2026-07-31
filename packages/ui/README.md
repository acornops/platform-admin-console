# `@acornops/ui`

Repository-local replica of the Management Console's domain-neutral React
component foundation. Import component APIs and global foundations separately:

```ts
import { Button, PageShell } from '@acornops/ui';
import '@acornops/ui/fonts';
import '@acornops/ui/tokens.css';
```

The package owns presentation primitives only. Routes, API clients,
authentication, platform roles, and governance semantics remain in the
Platform Admin Console.
