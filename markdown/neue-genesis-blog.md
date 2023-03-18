!!meta-define:ident:neue-genesis-blog
!!meta-define:title:新世纪 CoreBlog 的设计与实现
!!meta-define:author:Chuigda WhiteGive
!!meta-define:time:2023-01-20T11:21:00+08:00
!!meta-define:tags:前端,JavaScript
!!meta-define:brief:在经过了一番折腾之后，我的新新博客系统终于出生了。

马上就是（农历）2023 年了，因为 CoreBlog V1 已经年久失修，CoreBlog V2 中道崩殂，所以我翻来覆去思想斗争了半个小时，决定重写一个新的博客系统。这篇 blog 主要记录了我是如何 xjb 设计出 CoreBlogNG 这么个缝合怪架构，并把它糊出来的。

## 技术选择

按照原先的计划，这个 BLOG 还是要用 React 或者 Vue 这样的常规 SPA 技术来实现。不巧我吐槽选择困难的时候有人给我来了这么一句：

<div class="img-container">
<img src="/extra/blog-images/flaribbit-suggest-vanilla.png" alt="这个人建议我用香草" width="445" height="358"/>
</div>

这让我突然意识到，其实我对于 Reactive Pattern 的需求并不是那么大，我要做的只是：
- 把博客信息从“后端”拉出来
- 装进前端页面里

所以就算我直接操作 DOM，也不会有太大的问题。更何况少一点组件就少一点体积，用户加载就能快一点。<del>国际化？反正又没老外看我 Blog，摆了。</del>

## 准备工作

### 打包器

虽然并不用 React 或者 Vue 之类的玩意，但找个打包器还是有必要的。打包器能把各种各样的文件打包压缩进一组 `index.js` / `index.css`，这样就能减少 HTTP 请求的次数，提高加载速度。我选择了 [Vite](https://vitejs.dev/)，因为它热更新和打包的速度都很快，而且不需要太多配置。

### tsx-dom

要直接操作 DOM，就少不了一堆 DOM API：

```javascript
const div = document.createElement('div')
// ...
document.getElementById(someId).appendChild(div)
```

显然这样做真的是太难受了。考虑到反正已经用打包器了，不如干脆再接个转译器，借个 JSX 之类的东西过来。于是我就找到了 [tsx-dom](https://www.npmjs.com/package/tsx-dom)。有了它就可以在香草 JavaScript 里使用 JSX 了。

```jsx
const div = (
   <div class="container">
      <h1>Hello World</h1>
   </div>
)
document.getElementById(someId).appendChild(div)
```

这些 JSX 会被直接转译成 DOM 操作，连 VDOM 都省了！

### fake jQuery

就算有了 tsx-dom，每次都要写 `document.getElementById` 或者 `fetch` 的话也还是太麻烦了，真的是太难受了呀。但是完整的 [jQuery](https://jquery.com/) 和 [axios](https://axios-http.com/docs/intro) 又太重了，引入它们的话好不容易减下去的体重又要上来了。所以我直接写了一个 fake jQuery:

```javascript
const ajax = {
   get: async (url, headers, responder) => {
      responder = responder || (x => x.json())
      const resp = await fetch(url, {headers})
      return await responder(resp)
   }
}

self.$ = s => s ? document.querySelector(s) : ajax
```

这样就可以用 `$` 来代替 `document.querySelector` ，用 `$().get` 来代替 `fetch` 了。出于某种奇怪的原因，我直接把这个东西内联进了 `index.html` 里。当然，因为我用的是 TSX，所以为了防止 `tsc` 不满意，我补了个 `.d.ts`：

```typescript
interface FakeJQuery {
   get<T>(
      url: string,
      headers?: Record<string, string>,
      responder?: (resp: Response) => Promise<T>
   ): Promise<T>
}

declare function $(selector: string): HTMLElement
declare function $(): FakeJQuery
```

## 静态博客生成

以前版本的 CoreBlog 都会有个后端，把 Blog 和一些其他信息存在数据库里。不过这次我懒得折腾服务器了。想想看，静态的其实就挺好，因为压根没什么人过来看，也不会有什么评论，更不会有人用我那个煞有介事的“多租户”功能。

我把博客系统设计成 “只要在指定目录下写博客，然后运行一下生成，就能自动生成整个静态站点”。我决定先支持 Markdown 格式。但是r如果要直接从 Markdown 里提取标题/简述/作者信息/发布日期等信息，就得理解 Markdown 被解析出来之后的 Core Syntax，真的是太难受了。所以我干脆要求在每个 Markdown 文件里都加一段 `!!meta-define`，就像这样：

```text
!!mеta-define:ident:neue-genesis-blog
!!mеta-define:title:新世纪 CoreBlog 的设计与实现
!!mеta-define:author:Chuigda WhiteGive
!!mеta-define:time:2023-01-20T11:21:00+08:00
!!mеta-define:tags:前端,JavaScript
!!mеta-define:brief:在经过了一番折腾之后，我的新新博客系统终于出生了。
```

这样我就能用非常简单的 JavaScript 提取它们了：

```javascript
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
```

对每个文件提取完毕之后，我就可以把它们按照时间排序，然后生成一个 TOC 了。

```javascript
liberalList.sort((a, b) => b.timestamp - a.timestamp)
techList.sort((a, b) => b.timestamp - a.timestamp)

fs.writeFileSync(`${targetDir}/list/tech`, JSON.stringify(techList))
fs.writeFileSync(`${targetDir}/list/liberal`, JSON.stringify(liberalList))
```

完整代码参见 `scripts/compile.cjs`，最后生成的目录结构大致是：
```
  data
  |- blog
  |  |- timestamp1-ident1
  |  |- timestamp2-ident2
  |- list
     |- liberal
     |- tech
```

## 前端路由

我不喜欢加载新内容的时候浏览器刷新的样子，真的太难受了，所以我还是弄了个前端路由。这一步其实比我想的简单 —— 监听一下 url hash 的变化，然后 “挂载” 对应的 DOM 就可以了。具体的代码实现的仍然非常 dirty。

```jsx
const handleRoute = () => {
   const app = $('#app')
   const path = window.location.hash
      .slice(1)
      .split('/')
      .filter(part => part !== '')

   app.innerHTML = ''
   if (path.length === 0 || path[0] === 'liberal') {
      app.appendChild(<BlogList liberal={true} />)
   } else if (path[0] === 'tech') {
      app.appendChild(<BlogList liberal={false} />)
   } else if (path[0] === 'about') {
      app.appendChild(<About />)
   } else if (path[0] === 'link') {
      app.appendChild(<div>友链功能尚未完成，敬请期待</div>)
   } else if (path[0] === 'blog') {
      app.appendChild(<BlogRead blogId={ path[1] }/>)
   }
}

const App = () => {
   window.addEventListener('hashchange', handleRoute)
   setTimeout(handleRoute, 0)

   return (
      <div>
         <NavBar />
         <hr/>
         <div id="app">
         </div>
      </div>
   )
}

$('body').appendChild(<App />)
```

## 结论

最后的结果就是我做出了这么一个非常小小小小小的 Blog，看到这个打包尺寸我终于舒服了。

<div class="img-container">
<img src="/extra/blog-images/show-off-packed-size.png" alt="不炫耀一下这个打包尺寸真的太难受了呀" width="342" height="114"/>
</div>
