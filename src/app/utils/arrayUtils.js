// src/app/utils/arrayUtils.js

export const merge = (arrayList1, arrayList2) => [
  ...[]
    .concat(arrayList1, arrayList2)
    .reduce((r, c) => r.set(c.fingerprint, Object.assign(r.get(c.fingerprint) || {}, c)), new Map())
    .values(),
]

export const leftJoin = ({ notes, emails = [] }) => {
  console.log(`Joining ${notes.length} notes with ${emails.length} emails`)
  return notes.map((note) => ({
    note,
    email: emails.find((email) => email.fingerprint === note.fingerprint),
  }))
}

export const chunkArray = (array, chunkSize) => {
  const chunks = []
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize))
  }
  return chunks
}
