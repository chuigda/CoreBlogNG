const fs = require('fs')
const showdown = require('showdown')
const dayjs = require('dayjs')

const converter = new showdown.Converter()

const markdownDir = process.argv[2]
const targetDir = process.argv[3]

const liberalList = []
const techList = []

fs.readdirSync(markdownDir)
   .filter(file => file.endsWith('.md'))
   .forEach(file => {
      const fileContent = {}
      const markdownLines = fs.readFileSync(`${markdownDir}/${file}`, 'utf8')
         .split('\n')
         .filter(line => {
            const trimmed = line.trim()
            if (trimmed.startsWith('!!meta-define')) {
               const meta = trimmed.split(':')
               fileContent[meta[1]] = meta.slice(2).join(':')
               return false
            } else {
               return true
            }
         })

      fileContent.html = converter.makeHtml(markdownLines.join('\n'))

      const { ident, time, liberal } = fileContent
      if (!ident) {
         console.error(`[E] source file '${file}' does not contain a valid 'ident' meta block`)
         return
      }

      if (!time) {
         console.error(`[E] source file '${file}' does not contain a valid 'time' meta block`)
      }

      fileContent.timestamp = dayjs(time).unix()

      const fileName = `${fileContent.timestamp}-${ident}`
      console.info(`[I] generating '${fileName}' from '${file}'`)
      fs.writeFileSync(`${targetDir}/blog/${fileName}`, JSON.stringify(fileContent))

      delete fileContent.html

      if (liberal) {
         liberalList.push(fileContent)
      } else {
         techList.push(fileContent)
      }
   })

liberalList.sort((a, b) => b.timestamp - a.timestamp)
techList.sort((a, b) => b.timestamp - a.timestamp)

console.info(`[I] generating ${targetDir}/list/tech`)
fs.writeFileSync(`${targetDir}/list/tech`, JSON.stringify(techList))
console.info(`[I] generating ${targetDir}/list/liberal`)
fs.writeFileSync(`${targetDir}/list/liberal`, JSON.stringify(liberalList))
