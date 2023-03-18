const fs = require('fs')

const dataDir = process.argv[2]
const targetDir = process.argv[3]
const configFile = process.argv[4] ?? './src/config.json'
const linkFile = process.argv[5] ?? './public/link.json'

const liberalList = JSON.parse(fs.readFileSync(`${dataDir}/list/liberal` , { encoding: 'utf-8' }))
const techList = JSON.parse(fs.readFileSync(`${dataDir}/list/tech`, { encoding: 'utf-8' }))

// language=CSS
const commonStyle = `body {
    max-width: 800px;
   margin: 10px auto 0;
   padding-left: 4px;
   padding-right: 4px;
}`

const headerBar = `
<div class="header-bar">
    <a href="/js-free/index.html">随想</a>
    <a href="/js-free/index-tech.html">技术</a>
    <a href="/js-free/about.html">关于</a>
    <a href="/js-free/link.html">友链</a>
    <a href="/">返回普通版本</a>
</div>
<hr />`

const formatIndexPage = blogList => {
   const renderedBlogList = blogList.map(blog => `
      <div class="blog">
         <a href="/js-free/blog/${blog.timestamp}-${blog.ident}.html">${blog.title}</a>
         <hr />
         <div>${blog.brief}</div>
      </div>
   `)

   return `<!DOCTYPE html>
<html lang="en">
<head>
   <meta charset="UTF-8" />
   <title>CoreBlogNG</title>
   <style>
      ${commonStyle}

      .blog {
         border: 1px solid black;
         margin-bottom: 10px;
         padding: 4px;
      }
   </style>
</head>
<body>
   ${headerBar}
   <div class="blog-list">
      ${renderedBlogList.join('')}
   </div>
</body>
</html>`
}

fs.writeFileSync(`${targetDir}/index.html`, formatIndexPage(liberalList))
fs.writeFileSync(`${targetDir}/index-tech.html`, formatIndexPage(techList))

const formatBlogPage = blog => {
   return
}

const generateBlogPage = meta => {
   const blog = JSON.parse(fs.readFileSync(
      `${dataDir}/blog/${meta.timestamp}-${meta.ident}`,
      { encoding: 'utf-8' }
   ))
   fs.writeFileSync(
      `${targetDir}/blog/${meta.timestamp}-${meta.ident}.html`,
      `<!DOCTYPE html>
<html lang="en">
   <head>
      <meta charset="UTF-8" />
      <title>CoreBlogNG - ${blog.title}</title>
      <style>
          ${commonStyle}
         
         .blog > h1 {
            text-align: center;
         }
      </style>
   </head>
   <body>
      ${headerBar}
      <div class="blog">
         <h1>${blog.title}</h1>
         <div class="blog-content">${blog.html}</div>
      </div>
   </body>
</html>`)
}

liberalList.forEach(generateBlogPage)
techList.forEach(generateBlogPage)

const config = JSON.parse(fs.readFileSync(configFile, { encoding: 'utf-8' }))
const contacts = config.blog.links.map(contact => {
   if (contact.link) {
      return `● ${contact.title}: <a href="${contact.link}">${contact.text}</a>`
   } else {
      return `● ${contact.title}: ${contact.text}`
   }
})
fs.writeFileSync(`${targetDir}/about.html`, `<!DOCTYPE html>
<html lang="en">
   <head>
      <meta charset="UTF-8" />
      <title>关于 CoreBlogNG</title>
      <style>
          ${commonStyle}
         
         .about {
            text-align: center;
         }

         .about-inner {
            display: inline-block;
            margin: 0 auto;
         }
          
         .contacts {
            text-align: left;
         }

         img {
            width: 160px;
            height: 160px;
         }
      </style>
   </head>
   <body>
      ${headerBar}
      <div class="about">
         <div class="about-inner">
            <h1>${config.blog.name}</h1>
            <br />
            <img src="/${config.blog.avatar}" alt="avatar" />
            <br />
            <div class="contacts">${contacts.join('<br />\n')}</div>
            <br />
            <div>“${config.blog.description}”</div>
         </div>
      </div>
   </body>
`)

const link = JSON.parse(fs.readFileSync(linkFile, { encoding: 'utf-8' }))
const links = link.map(link => {
   return `● <a href="${link.link}">${link.name}</a> “${link.description}”`
})
fs.writeFileSync(`${targetDir}/link.html`, `<!DOCTYPE html>
<html lang="en">
   <head>
      <meta charset="UTF-8" />
      <title>友链</title>
      <style>
         ${commonStyle}
      </style>
   <head>
   <body>
      ${headerBar}
      <div class="link">
         ${links.join('<br />\n')}
      </div>
   </body>
</html>`)
