#!/usr/bin/env node
/** Reports i18n wiring coverage across pages and components. */
import fs from 'node:fs'
import path from 'node:path'

const walk = (d, acc = []) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p, acc)
    else if (e.name.endsWith('.tsx')) acc.push(p)
  }
  return acc
}

const wired = (f) => /useTranslations|getTranslations/.test(fs.readFileSync(f, 'utf8'))
const lines = (f) => fs.readFileSync(f, 'utf8').split('\n').length
const rel = (f) => f.split(path.sep).join('/')

const pages = walk('src/app').filter((f) => f.endsWith('page.tsx'))
const components = walk('src/components')
const pagesTodo = pages.filter((f) => !wired(f))
const compsTodo = components.filter((f) => !wired(f))

console.log(`PAGINE:      ${pages.length - pagesTodo.length}/${pages.length} tradotte`)
console.log(`COMPONENTI:  ${components.length - compsTodo.length}/${components.length} tradotti`)
console.log('')
console.log(`PAGINE RESTANTI (${pagesTodo.length}):`)
pagesTodo
  .map((f) => [rel(f), lines(f)])
  .sort((a, b) => b[1] - a[1])
  .forEach(([f, n]) => console.log(`  ${String(n).padStart(5)}  ${f.replace('src/app', '')}`))
