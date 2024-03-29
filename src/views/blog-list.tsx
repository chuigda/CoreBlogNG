import { h } from 'tsx-dom'
import dayjs from 'dayjs'

import config from '../config.json'
import './blog-list.css'

const { api: { base } } = config

// @ts-ignore
const BlogList = ({ liberal }) => {
   setTimeout(async () => {
      const blogs = await $().get(`${base}/list/${liberal ? 'liberal' : 'tech'}`)
      const blogList = $('#blog-list')
      // @ts-ignore
      blogs.forEach(({ title, brief, time, timestamp, ident, author, hidden }) => {
         if (hidden) return

         blogList.appendChild(
            <div class="blog-item">
               <h2>
                  <a onClick={e => {
                     e.preventDefault()
                     window.location.hash = `/blog/${timestamp}-${ident}`
                  }} tabIndex={0} href={`/#/blogs/${timestamp}-${ident}`}>
                     {title}
                  </a>
               </h2>
               <div class="brief">{brief}</div>
               <div class="author-line">由 <b>{author}</b> 发布于 { dayjs(time).format('YYYY 年 M 月 D 日 HH:mm:ss') }</div>
            </div>
         )
      })

      $('#dynamicJSONLD').innerHTML = JSON.stringify({
         '@context': 'https://schema.org',
         '@type': 'Blog list',
         'name': `CoreBlogNG ${liberal ? 'liberal' : 'technology'} blog list`,
         'description': `CoreBlogNG ${liberal ? 'liberal' : 'technology'} blog list page`
      })

   }, 0)

   return (
      <div id="blog-list">
      </div>
   )
}

export default BlogList
