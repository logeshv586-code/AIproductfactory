## Problem

What is missing, broken or unnecessarily difficult?

## Layer changed

- [ ] Capability
- [ ] Product blueprint
- [ ] Offline runtime
- [ ] Online / MCP extension
- [ ] Product reasoning / contracts
- [ ] Verification / isolated runner
- [ ] Studio UX
- [ ] Developer experience / CI
- [ ] Documentation
- [ ] Other

## Offline behavior

What works with public network disabled?

## Optional connected behavior

Which MCP/API/SaaS/live-data integration is added, if any?

## Fallback

What happens when that connected service is unavailable?

## Verification

How was this tested?

- [ ] `npm run lint`
- [ ] `npx tsc --noEmit`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] Python tests
- [ ] Isolated runner / acceptance path
- [ ] Manual validation required (explain below)

## Scope safety

- [ ] Does not silently change approved product contracts
- [ ] Does not let implementation code redefine acceptance
- [ ] Does not introduce hidden runtime downloads
- [ ] New third-party source/dependency licensing was reviewed
- [ ] Docs were updated where needed

## Screenshots / evidence

Add useful UI screenshots, logs or test evidence.

## Notes for reviewers

Anything that deserves extra attention?
