// src/app/utils/mergingFns.js

export const merge = (arrayList1, arrayList2) => [
  ...[]
    .concat(arrayList1, arrayList2)
    .reduce(
      (r, c) =>
        r.set(c.fingerprint, Object.assign(r.get(c.fingerprint) || {}, c)),
      new Map(),
    )
    .values(),
]

export const leftJoin = ({ notes, emails = [] }) =>
  notes.map((note) => ({
    note,
    email: emails.find((email) => email.fingerprint === note.fingerprint),
  }))
