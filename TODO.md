Next?

- [ ] Build Script

What's left?

- [x] Completed
  - [x] Ability to show encryption key
  - [x] Update items
  - [x] NOT update items that are older than lastSyncUpdate
  - [x] Draft versioning (local?)
  - [x] General refactoring
  - [x] can't save encryption key when none is present
  - [x] shouldn't complain about invalid non-key
  - [x] update UI when syncing posts
  - [x] don't sync Empty / Untitled
- [ ] Release 1
  - [x] Per-Post AES Keys
  - [x] Out-of-Sync Indicator (`updated > synced_at`)
  - [x] Manual Sync Button
  - [x] Count items & bytes
  - [x] BUG: summaries `> summary of thing` are being eaten
  - [ ] What to do when the current draft is out of date? (reload indicator?)
- [ ] Release 2
  - [ ] Paywall
  - [ ] Deleted things marked as null
  - [ ] Deleted things don't count against quotas
- [ ] Future
  - [ ] re-key library
  - [ ] Fine-tuned refactoring
  - [ ] Payments
    - [ ] Paypal
    - [ ] NMI anonymous, not stripe
    - [ ] Apple, Google, Amazon, etc
  - [ ] Hash'n'Cache / bundle assets (Service Workers?)
