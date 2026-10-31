# CommonFund Mongoose models

These Mongoose models describe the CommonFund users, savings groups, members,
and contribution or payout transactions. Collection names and field
relationships follow the existing SQL schema. They are a model layer only;
the current Flask application still uses SQLite and does not connect to MongoDB.

## Install

```sh
npm install
```

Import models from `models/index.js`. For example:

```js
import { Member, SavingsGroup, Transaction, User } from './models/index.js'
```

Money is stored as a positive integer in the currency's minor unit, matching
`amount_minor` in the SQL schema. `createdAt` and `updatedAt` are managed by
Mongoose.

## Validate

```sh
npm test
```
